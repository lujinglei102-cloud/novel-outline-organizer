import type { Card, SortGap, Character, Link } from '@/types'
import type { TurningPoint } from '@/engine/narrativeLine'
import { sortNarrativeLine } from '@/engine/narrativeLine'
import { extractCharacters } from '@/engine/characterExtract'
import { findForeshadowLinks } from '@/engine/foreshadowLink'
import type { SortWorkerResponse } from './sort.worker'

export interface SortComputeResult {
  sortedCards: Card[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
  characters: Character[]
  cardCharacterMapEntries: [string, string][]
  links: Link[]
  emotionSeries: { x: number; y: number; cardId: string }[]
}

/**
 * 同步计算 fallback（在 Worker 不可用时使用，比如 jsdom 测试环境）
 */
export function computeSortSync(cards: Card[]): SortComputeResult {
  const { cards: sorted, gaps, turningPoints } = sortNarrativeLine(cards)
  const charResult = extractCharacters(sorted)
  const foundLinks = findForeshadowLinks(sorted)
  return {
    sortedCards: sorted,
    gaps,
    turningPoints,
    characters: charResult.characters,
    cardCharacterMapEntries: Array.from(charResult.cardCharacterMap.entries()),
    links: foundLinks,
    emotionSeries: sorted.map((c, i) => ({ x: i, y: c.emotion ?? 0, cardId: c.id })),
  }
}

let workerInstance: Worker | null = null
let workerInitFailed = false
let requestId = 0
const pending = new Map<number, { resolve: (v: SortComputeResult) => void; reject: (e: unknown) => void }>()

/**
 * 检测当前是否在测试环境（jsdom 不支持真实 Worker）。
 * - Vitest 会设置 import.meta.env.MODE === 'test'
 * - 同时检测 navigator.userAgent 是否包含 jsdom
 */
function isTestEnv(): boolean {
  try {
    if (import.meta.env?.MODE === 'test') return true
  } catch {
    // ignore
  }
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return true
  return false
}

function getWorker(): Worker | null {
  if (workerInitFailed) return null
  if (isTestEnv()) return null
  if (workerInstance) return workerInstance
  try {
    // Vite 推荐的 Worker 加载语法，构建时会单独打包
    workerInstance = new Worker(new URL('./sort.worker.ts', import.meta.url), { type: 'module' })
    workerInstance.onmessage = (e: MessageEvent) => {
      const data = e.data as SortWorkerResponse & { error?: string }
      const handler = pending.get(data.id)
      if (!handler) return
      pending.delete(data.id)
      if (data.error) {
        handler.reject(new Error(data.error))
      } else {
        handler.resolve({
          sortedCards: data.sortedCards,
          gaps: data.gaps,
          turningPoints: data.turningPoints,
          characters: data.characters,
          cardCharacterMapEntries: data.cardCharacterMapEntries,
          links: data.links,
          emotionSeries: data.emotionSeries,
        })
      }
    }
    workerInstance.onerror = (err) => {
      console.warn('[sortClient] Worker 运行出错，回退到同步计算', err)
      // 失败所有 pending 任务
      for (const [id, handler] of pending) {
        pending.delete(id)
        handler.reject(new Error('worker error'))
      }
      workerInitFailed = true
      workerInstance = null
    }
    return workerInstance
  } catch (err) {
    console.warn('[sortClient] Worker 初始化失败，回退到同步计算', err)
    workerInitFailed = true
    return null
  }
}

/**
 * 在 Worker 中异步执行梳理计算；不可用时回退到同步计算。
 * 测试环境（jsdom）通常无法创建 Worker，会自动走 fallback。
 */
export function runSortInWorker(cards: Card[]): Promise<SortComputeResult> {
  const worker = getWorker()
  if (!worker) {
    return Promise.resolve(computeSortSync(cards))
  }
  const id = ++requestId
  return new Promise<SortComputeResult>((resolve, reject) => {
    // 安全网：3s 内未响应则回退同步计算（避免极端环境卡死）
    const timer = setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      console.warn('[sortClient] Worker 3s 未响应，回退同步计算')
      resolve(computeSortSync(cards))
    }, 3000)
    const origResolve = resolve
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer)
        origResolve(v)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      },
    })
    worker.postMessage({ id, cards })
  })
}
