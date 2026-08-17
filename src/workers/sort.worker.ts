import type { Card, SortGap, Character, Link } from '@/types'
import type { TurningPoint } from '@/engine/narrativeLine'
import { sortNarrativeLine } from '@/engine/narrativeLine'
import { extractCharacters } from '@/engine/characterExtract'
import { findForeshadowLinks } from '@/engine/foreshadowLink'

/**
 * 梳理 Web Worker
 * 把排序、角色识别、伏笔关联、情绪曲线计算放到独立线程，避免阻塞 UI。
 * 主线程通过 sortClient.runSortInWorker 调用，结果以 postMessage 回传。
 */

export interface SortWorkerRequest {
  id: number
  cards: Card[]
}

export interface SortWorkerResponse {
  id: number
  sortedCards: Card[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
  characters: Character[]
  cardCharacterMapEntries: [string, string][]
  links: Link[]
  emotionSeries: { x: number; y: number; cardId: string }[]
}

interface WorkerScope {
  postMessage(msg: unknown): void
  addEventListener(type: 'message', handler: (e: MessageEvent) => void): void
}

const scope = self as unknown as WorkerScope

scope.addEventListener('message', (e: MessageEvent<SortWorkerRequest>) => {
  const { id, cards } = e.data
  try {
    const { cards: sorted, gaps, turningPoints } = sortNarrativeLine(cards)
    const charResult = extractCharacters(sorted)
    const foundLinks = findForeshadowLinks(sorted)
    const emotionSeries = sorted.map((c, i) => ({
      x: i,
      y: c.emotion ?? 0,
      cardId: c.id,
    }))
    const response: SortWorkerResponse = {
      id,
      sortedCards: sorted,
      gaps,
      turningPoints,
      characters: charResult.characters,
      cardCharacterMapEntries: Array.from(charResult.cardCharacterMap.entries()),
      links: foundLinks,
      emotionSeries,
    }
    scope.postMessage(response)
  } catch (err) {
    // 出错时回传错误信息，主线程会 fallback 到同步计算
    scope.postMessage({
      id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})
