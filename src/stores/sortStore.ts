import { create } from 'zustand'
import type { Card, Character, Link, Chapter, SortGap, Template, StructuralAnalysis } from '@/types'
import { getAllCards } from '@/db/cardRepo'
import { getAllCharacters, putCharacters, updateCharacter, deleteCharacter } from '@/db/characterRepo'
import { getAllLinks, putLinks, toggleLinkResolved } from '@/db/linkRepo'
import { getAllChapters, putChapters } from '@/db/chapterRepo'

import type { TurningPoint } from '@/engine/narrativeLine'
import { extractCharacters } from '@/engine/characterExtract'
import { findForeshadowLinks } from '@/engine/foreshadowLink'
import { tagEmotion, retagAll as engineRetagAll } from '@/engine/emotionTag'
import { generateSkeletonDirections, splitIntoChapters } from '@/engine/skeletonGen'
import { TEMPLATES } from '@/data/templates'
import { runSortInWorker } from '@/workers/sortClient'

export interface SkeletonDirection {
  templateId: string
  templateName: string
  boundaries: number[] // 每个节点对应的卡片分界 index（前缀和长度）
  nodeRatios: number[]
}

/**
 * 计算卡片列表的内容指纹（用于梳理结果缓存命中判断）
 * 指纹由卡片数量 + 每张卡的关键字段（id/updatedAt/content长度/emotion/intensity/stage）组成
 * 卡片顺序无关（先按 id 排序），任何字段变化都会改变指纹
 */
function computeCardsFingerprint(cards: Card[]): string {
  if (cards.length === 0) return '0_empty'
  const sig = cards
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (c) =>
        `${c.id}:${c.updatedAt ?? 0}:${c.content?.length ?? 0}:${c.emotion ?? 0}:${c.intensity ?? 1}:${c.stage ?? 'none'}`,
    )
    .join('|')
  // 简单 djb2 hash
  let h = 5381
  for (let i = 0; i < sig.length; i++) {
    h = ((h << 5) + h + sig.charCodeAt(i)) | 0
  }
  return `${cards.length}_${(h >>> 0).toString(16)}`
}

/** 梳理结果缓存：同批卡片未改则秒出 */
interface SortCache {
  fingerprint: string
  sortedCards: Card[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
  characters: Character[]
  cardCharacterMap: Record<string, string>
  links: Link[]
  emotionSeries: { x: number; y: number; cardId: string }[]
  structuralAnalysis: StructuralAnalysis
  cachedAt: number
}

interface SortState {
  // narrative
  sortedCards: Card[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
  structuralAnalysis: StructuralAnalysis | null
  sortedAt: number | null
  // characters
  characters: Character[]
  cardCharacterMap: Record<string, string>
  // links
  links: Link[]
  // emotion curve data
  emotionSeries: { x: number; y: number; cardId: string }[] // sorted order index vs emotion
  // skeleton
  skeletonDirections: SkeletonDirection[]
  selectedDirectionIdx: number
  activeTemplateId: string | null
  nodes: string[] // 当前结构节点名（默认模板）+ 用户自定义
  // chapters
  chapters: Chapter[]
  // 梳理结果缓存（T3.8）
  lastSortCache: SortCache | null
  lastCacheHit: boolean // 上次操作是否命中缓存（便于 UI 提示）
  // actions
  runSort: () => Promise<void>
  runCharacters: (cards?: Card[]) => Promise<void>
  removeCharacter: (id: string) => Promise<void>
  renameCharacter: (id: string, name: string) => Promise<void>
  runLinks: (cards?: Card[]) => Promise<void>
  toggleLinkResolved: (id: string) => Promise<void>
  toggleForeshadowCard: (cardId: string) => Promise<void>
  runEmotionRetag: () => Promise<void>
  refreshEmotionSeries: () => void
  restoreManualEmotion: () => Promise<void>
  saveTagToCard: (cardId: string, emotion: number, intensity: number) => Promise<void>
  runSkeletonDirections: (
    preferredTemplateIds?: string[],
  ) => Promise<void>
  selectDirection: (idx: number) => void
  applyChaptersFromDirection: (perNode?: number) => Promise<void>
  saveChapter: (id: string, patch: Partial<Pick<Chapter, 'title' | 'conflict' | 'cardIds' | 'nodeId' | 'index'>>) => Promise<void>
  reorderCards: (fromIndex: number, toIndex: number) => Promise<void>
  addNode: (name: string) => void
  renameNode: (index: number, name: string) => void
  removeNode: (index: number) => void
  loadPersisted: () => Promise<void>
  resetAll: () => void
  // 缓存失效：卡片变更时调用
  invalidateCache: () => void
  // util
  getNodes: () => string[]
  getActiveTemplate: () => Template | undefined
}

function computeEmotionSeries(cards: Card[]) {
  return cards.map((c, i) => ({
    x: i,
    y: c.emotion ?? 0,
    cardId: c.id,
  }))
}

export const useSortStore = create<SortState>((set, get) => ({
  sortedCards: [],
  gaps: [],
  turningPoints: [],
  structuralAnalysis: null,
  sortedAt: null,
  characters: [],
  cardCharacterMap: {},
  links: [],
  emotionSeries: [],
  skeletonDirections: [],
  selectedDirectionIdx: 0,
  activeTemplateId: null,
  nodes: [], // 空数组代表跟随默认模板
  chapters: [],
  lastSortCache: null,
  lastCacheHit: false,

  runSort: async () => {
    const cards = await getAllCards()
    const fingerprint = computeCardsFingerprint(cards)
    const cache = get().lastSortCache
    // 命中缓存：同批卡片未改则秒出
    if (cache && cache.fingerprint === fingerprint) {
      console.log('[runSort] 缓存命中，跳过重算（fingerprint=' + fingerprint + '）')
      set({
        sortedCards: cache.sortedCards,
        gaps: cache.gaps,
        turningPoints: cache.turningPoints,
        structuralAnalysis: cache.structuralAnalysis,
        sortedAt: cache.cachedAt,
        emotionSeries: cache.emotionSeries,
        characters: cache.characters,
        cardCharacterMap: cache.cardCharacterMap,
        links: cache.links,
        lastCacheHit: true,
      })
      return
    }
    console.log('[runSort] 缓存未命中，重新计算（fingerprint=' + fingerprint + '）')
    // 排序/角色/伏笔/情绪曲线计算放到 Web Worker，避免阻塞 UI
    const computed = await runSortInWorker(cards)
    const sorted = computed.sortedCards
    const gaps = computed.gaps
    const turningPoints = computed.turningPoints
    const structuralAnalysis = computed.structuralAnalysis
    const charResult = { characters: computed.characters, cardCharacterMap: new Map(computed.cardCharacterMapEntries) }
    const foundLinks = computed.links
    const emotionSeries = computed.emotionSeries
    const newCache: SortCache = {
      fingerprint,
      sortedCards: sorted,
      gaps,
      turningPoints,
      structuralAnalysis,
      characters: charResult.characters,
      cardCharacterMap: Object.fromEntries(charResult.cardCharacterMap),
      links: foundLinks,
      emotionSeries,
      cachedAt: Date.now(),
    }
    set({
      sortedCards: sorted,
      gaps,
      turningPoints,
      structuralAnalysis,
      sortedAt: newCache.cachedAt,
      emotionSeries,
      characters: charResult.characters,
      cardCharacterMap: newCache.cardCharacterMap,
      links: foundLinks,
      lastSortCache: newCache,
      lastCacheHit: false,
    })
    // 写回 DB（角色和关联）
    await putCharacters(charResult.characters)
    await putLinks(foundLinks)
  },

  runCharacters: async (cardsIn) => {
    const cards = cardsIn ?? get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    // 若缓存已包含角色结果且指纹一致，直接使用缓存（不重算）
    const cache = get().lastSortCache
    if (cache && cache.characters.length > 0 && computeCardsFingerprint(cards) === cache.fingerprint) {
      console.log('[runCharacters] 缓存命中，跳过重算')
      set({
        characters: cache.characters,
        cardCharacterMap: cache.cardCharacterMap,
        lastCacheHit: true,
      })
      return
    }
    const r = extractCharacters(cards)
    set({ characters: r.characters, cardCharacterMap: Object.fromEntries(r.cardCharacterMap), lastCacheHit: false })
    await putCharacters(r.characters)
  },

  removeCharacter: async (id) => {
    await deleteCharacter(id)
    set({ characters: get().characters.filter((c) => c.id !== id) })
  },

  renameCharacter: async (id, name) => {
    if (!name.trim()) return
    await updateCharacter(id, { name: name.trim() })
    set({
      characters: get().characters.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
    })
  },

  runLinks: async (cardsIn) => {
    const cards = cardsIn ?? get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    // 若缓存已包含关联结果且指纹一致，直接使用缓存
    const cache = get().lastSortCache
    if (cache && cache.links.length >= 0 && computeCardsFingerprint(cards) === cache.fingerprint) {
      console.log('[runLinks] 缓存命中，跳过重算')
      set({ links: cache.links, lastCacheHit: true })
      return
    }
    const found = findForeshadowLinks(cards)
    set({ links: found, lastCacheHit: false })
    await putLinks(found)
  },

  toggleLinkResolved: async (id) => {
    await toggleLinkResolved(id)
    set({
      links: get().links.map((l) => (l.id === id ? { ...l, resolved: !l.resolved } : l)),
    })
  },

  toggleForeshadowCard: async (cardId) => {
    const card = get().sortedCards.find((c) => c.id === cardId)
    if (!card) return
    const newResolved = !card.foreshadowResolved
    const { updateCard } = await import('@/db/cardRepo')
    await updateCard(cardId, { foreshadowResolved: newResolved })
    set({
      sortedCards: get().sortedCards.map((c) =>
        c.id === cardId ? { ...c, foreshadowResolved: newResolved } : c,
      ),
      // 伏笔状态变化不影响叙事线/角色/情绪，但影响伏笔列表 → 失效缓存
      lastSortCache: null,
    })
  },

  runEmotionRetag: async () => {
    // 对已排序卡片重新打情绪标签（不写回 DB 立即，留存在 state 中让用户预览）
    const cards = get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    console.log('[runEmotionRetag] 自动补标开始，共', cards.length, '张卡片')
    // 打印补标前的情绪值
    console.log('[runEmotionRetag] 补标前:')
    cards.forEach((c, i) => {
      console.log(`  #${i + 1} [${c.id.slice(0, 8)}] ${c.title || '(无标题)'} | emotion=${c.emotion ?? 'undefined'} intensity=${c.intensity ?? 'undefined'} emotionManual=${c.emotionManual ?? false}`)
    })
    const tagged = engineRetagAll(cards) as Card[]
    // 打印补标后的情绪值及变化
    console.log('[runEmotionRetag] 补标后:')
    tagged.forEach((c, i) => {
      const oldE = cards[i]?.emotion ?? 0
      const oldI = cards[i]?.intensity ?? 1
      const eChanged = c.emotion !== oldE
      const iChanged = c.intensity !== oldI
      const flag = eChanged || iChanged ? ' ⚡已变更' : ''
      console.log(`  #${i + 1} [${c.id.slice(0, 8)}] ${c.title || '(无标题)'} | emotion=${c.emotion} intensity=${c.intensity} emotionManual=${c.emotionManual ?? false}${flag}`)
      if (eChanged) console.log(`       情绪: ${oldE} → ${c.emotion}`)
      if (iChanged) console.log(`       冲突强度: ${oldI} → ${c.intensity}`)
    })
    const changedCount = tagged.filter((c, i) => c.emotion !== (cards[i]?.emotion ?? 0) || c.intensity !== (cards[i]?.intensity ?? 1)).length
    console.log(`[runEmotionRetag] 共变更 ${changedCount}/${tagged.length} 张卡片，其中 ${tagged.filter((c) => c.emotionManual).length} 张保留手动值`)
    set({ sortedCards: tagged, emotionSeries: computeEmotionSeries(tagged), lastSortCache: null })
  },

  refreshEmotionSeries: () => {
    // 只用当前 sortedCards 的情绪值刷新曲线，不重新标注（保留用户手动值）
    set({ emotionSeries: computeEmotionSeries(get().sortedCards) })
  },

  restoreManualEmotion: async () => {
    // 从 DB 重新加载卡片，保持当前排序顺序，恢复 DB 中的情绪值
    const beforeCards = get().sortedCards
    console.log('[restoreManualEmotion] 恢复手动标注开始，当前', beforeCards.length, '张卡片')
    // 打印恢复前（自动补标后）的情绪值
    console.log('[restoreManualEmotion] 恢复前(自动补标结果):')
    beforeCards.forEach((c, i) => {
      console.log(`  #${i + 1} [${c.id.slice(0, 8)}] ${c.title || '(无标题)'} | emotion=${c.emotion ?? 'undefined'} intensity=${c.intensity ?? 'undefined'}`)
    })
    const dbCards = await getAllCards()
    const currentOrder = get().sortedCards.map((c) => c.id)
    const restored = currentOrder
      .map((id) => dbCards.find((c) => c.id === id))
      .filter(Boolean) as Card[]
    // 打印恢复后（DB 中的原始值）的情绪值及变化
    console.log('[restoreManualEmotion] 恢复后(DB原始值):')
    restored.forEach((c, i) => {
      const oldE = beforeCards[i]?.emotion ?? 0
      const oldI = beforeCards[i]?.intensity ?? 1
      const eChanged = c.emotion !== oldE
      const iChanged = c.intensity !== oldI
      const flag = eChanged || iChanged ? ' ⚡已恢复' : ''
      console.log(`  #${i + 1} [${c.id.slice(0, 8)}] ${c.title || '(无标题)'} | emotion=${c.emotion ?? 'undefined'} intensity=${c.intensity ?? 'undefined'} emotionManual=${c.emotionManual ?? false}${flag}`)
      if (eChanged) console.log(`       情绪: ${oldE} → ${c.emotion}`)
      if (iChanged) console.log(`       冲突强度: ${oldI} → ${c.intensity}`)
    })
    const changedCount = restored.filter((c, i) => c.emotion !== (beforeCards[i]?.emotion ?? 0) || c.intensity !== (beforeCards[i]?.intensity ?? 1)).length
    console.log(`[restoreManualEmotion] 共恢复 ${changedCount}/${restored.length} 张卡片到 DB 原始值`)
    set({ sortedCards: restored, emotionSeries: computeEmotionSeries(restored), lastSortCache: null })
  },

  saveTagToCard: async (cardId, emotion, intensity) => {
    // 更新本地 state + DB 同步（为了用户确认过的标注）
    const updated = get().sortedCards.map((c) =>
      c.id === cardId ? { ...c, emotion, intensity, emotionManual: true } : c,
    )
    set({
      sortedCards: updated,
      emotionSeries: computeEmotionSeries(updated),
      // 手动改情绪值 → 失效缓存（指纹中包含 emotion/intensity）
      lastSortCache: null,
    })
    // DB
    const { updateCard } = await import('@/db/cardRepo')
    await updateCard(cardId, { emotion, intensity, emotionManual: true })
  },

  runSkeletonDirections: async (preferredTemplateIds) => {
    const cards = get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    const dirs = generateSkeletonDirections(cards, preferredTemplateIds)
    const N = cards.length
    const sk: SkeletonDirection[] = (dirs as any[]).map((d) => ({
      templateId: d.templateId,
      templateName: d.templateName,
      boundaries: d.boundaries.map((b: any) => b.afterCardIndex),
      nodeRatios: d.boundaries.map((b: any, i: number) => {
        const prev = i === 0 ? -1 : d.boundaries[i - 1].afterCardIndex
        return N > 0 ? (b.afterCardIndex - prev) / N : 0
      }),
    }))
    const first = (dirs[0] as any) || {}
    const firstTpl = TEMPLATES.find((t) => t.id === first.templateId)
    const defaultNodes: string[] = firstTpl?.nodes ?? (TEMPLATES[0]?.nodes ?? [])
    set({
      skeletonDirections: sk,
      selectedDirectionIdx: 0,
      activeTemplateId: first.templateId || null,
      nodes: defaultNodes,
    })
  },

  selectDirection: (idx) => {
    const dirs = get().skeletonDirections
    if (idx < 0 || idx >= dirs.length) return
    const dir = dirs[idx]
    // 找到对应模板更新节点名
    const tpl = TEMPLATES.find((t) => t.id === dir.templateId)
    set({
      selectedDirectionIdx: idx,
      activeTemplateId: dir.templateId,
      nodes: tpl?.nodes ?? get().nodes,
    })
  },

  applyChaptersFromDirection: async (perNode = 2) => {
    const dir = get().skeletonDirections[get().selectedDirectionIdx]
    if (!dir) return
    const cards = get().sortedCards
    const nodes = get().getNodes()
    const tpl = TEMPLATES.find((t) => t.id === dir.templateId) ?? TEMPLATES[0]
    // 用 nodes 覆盖 template.nodes（用户可能自定义了节点名）
    const tplWithNodes = { ...tpl, nodes }
    const boundArr = dir.boundaries.map((afterCardIndex, nodeIndex) => ({ nodeIndex, afterCardIndex }))
    const chapterList = splitIntoChapters(cards, boundArr, tplWithNodes, perNode) as Chapter[]
    set({ chapters: chapterList })
    await putChapters(chapterList)
  },

  saveChapter: async (id, patch) => {
    const { updateChapter } = await import('@/db/chapterRepo')
    await updateChapter(id, patch)
    set({
      chapters: get().chapters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })
  },

  reorderCards: async (fromIndex, toIndex) => {
    const cards = [...get().sortedCards]
    if (fromIndex < 0 || fromIndex >= cards.length || toIndex < 0 || toIndex >= cards.length) return
    const [moved] = cards.splice(fromIndex, 1)
    cards.splice(toIndex, 0, moved)
    // 更新 order 字段（基于新位置）
    const updated = cards.map((c, i) => ({ ...c, order: i * 100 }))
    // 排序变化 → 失效缓存（叙事线、情绪曲线 x 轴都变）
    set({ sortedCards: updated, emotionSeries: computeEmotionSeries(updated), lastSortCache: null })
    // 写回 DB
    const { updateCard } = await import('@/db/cardRepo')
    await Promise.all(updated.map((c) => updateCard(c.id, { order: c.order })))
  },

  addNode: (name) => {
    if (!name.trim()) return
    set({ nodes: [...get().nodes, name.trim()] })
  },
  renameNode: (index, name) => {
    const next = [...get().nodes]
    if (index >= 0 && index < next.length) {
      next[index] = name || next[index]
      set({ nodes: next })
    }
  },
  removeNode: (index) => {
    const next = [...get().nodes]
    next.splice(index, 1)
    set({ nodes: next })
  },

  loadPersisted: async () => {
    const [characters, links, chapters] = await Promise.all([
      getAllCharacters(),
      getAllLinks(),
      getAllChapters(),
    ])
    set({ characters, links, chapters })
  },

  invalidateCache: () => {
    set({ lastSortCache: null, lastCacheHit: false })
  },

  resetAll: () =>
    set({
      sortedCards: [],
      gaps: [],
      turningPoints: [],
      structuralAnalysis: null,
      sortedAt: null,
      characters: [],
      cardCharacterMap: {},
      links: [],
      emotionSeries: [],
      skeletonDirections: [],
      selectedDirectionIdx: 0,
      activeTemplateId: null,
      nodes: [],
      chapters: [],
      lastSortCache: null,
      lastCacheHit: false,
    }),

  getNodes: () => {
    const s = get()
    if (s.nodes.length > 0) return s.nodes
    const tpl = s.getActiveTemplate()
    return tpl?.nodes ?? ['起', '承', '转', '合']
  },

  getActiveTemplate: () => {
    const id = get().activeTemplateId
    return TEMPLATES.find((t) => t.id === id)
  },
}))

// 重复导出 tagEmotion 供页面用
export const emotionTagEngine = { tagEmotion }
