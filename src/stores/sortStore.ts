import { create } from 'zustand'
import type { Card, Character, Link, Chapter, SortGap, Template } from '@/types'
import { getAllCards } from '@/db/cardRepo'
import { getAllCharacters, putCharacters } from '@/db/characterRepo'
import { getAllLinks, putLinks } from '@/db/linkRepo'
import { getAllChapters, putChapters } from '@/db/chapterRepo'

import { sortNarrativeLine } from '@/engine/narrativeLine'
import { extractCharacters } from '@/engine/characterExtract'
import { findForeshadowLinks } from '@/engine/foreshadowLink'
import { tagEmotion, retagAll as engineRetagAll } from '@/engine/emotionTag'
import { generateSkeletonDirections, splitIntoChapters } from '@/engine/skeletonGen'
import { TEMPLATES } from '@/data/templates'

export interface SkeletonDirection {
  templateId: string
  templateName: string
  boundaries: number[] // 每个节点对应的卡片分界 index（前缀和长度）
  nodeRatios: number[]
}

interface SortState {
  // narrative
  sortedCards: Card[]
  gaps: SortGap[]
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
  // actions
  runSort: () => Promise<void>
  runCharacters: (cards?: Card[]) => Promise<void>
  runLinks: (cards?: Card[]) => Promise<void>
  runEmotionRetag: () => Promise<void>
  saveTagToCard: (cardId: string, emotion: number, intensity: number) => Promise<void>
  runSkeletonDirections: (
    preferredTemplateIds?: string[],
  ) => Promise<void>
  selectDirection: (idx: number) => void
  applyChaptersFromDirection: (perNode?: number) => Promise<void>
  saveChapter: (id: string, patch: Partial<Pick<Chapter, 'title' | 'conflict' | 'cardIds' | 'nodeId' | 'index'>>) => Promise<void>
  addNode: (name: string) => void
  renameNode: (index: number, name: string) => void
  removeNode: (index: number) => void
  loadPersisted: () => Promise<void>
  resetAll: () => void
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

  runSort: async () => {
    const cards = await getAllCards()
    const { cards: sorted, gaps } = sortNarrativeLine(cards)
    // 把 order 回写到每张卡（仅 memory，用户确认后再保存）
    set({
      sortedCards: sorted,
      gaps,
      sortedAt: Date.now(),
      emotionSeries: computeEmotionSeries(sorted),
    })
  },

  runCharacters: async (cardsIn) => {
    const cards = cardsIn ?? get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    const r = extractCharacters(cards)
    set({ characters: r.characters, cardCharacterMap: Object.fromEntries(r.cardCharacterMap) })
    await putCharacters(r.characters)
  },

  runLinks: async (cardsIn) => {
    const cards = cardsIn ?? get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    const found = findForeshadowLinks(cards)
    set({ links: found })
    await putLinks(found)
  },

  runEmotionRetag: async () => {
    // 对已排序卡片重新打情绪标签（不写回 DB 立即，留存在 state 中让用户预览）
    const cards = get().sortedCards.length > 0 ? get().sortedCards : await getAllCards()
    const tagged = engineRetagAll(cards) as Card[]
    set({ sortedCards: tagged, emotionSeries: computeEmotionSeries(tagged) })
  },

  saveTagToCard: async (cardId, emotion, intensity) => {
    // 更新本地 state + DB 同步（为了用户确认过的标注）
    const updated = get().sortedCards.map((c) =>
      c.id === cardId ? { ...c, emotion, intensity } : c,
    )
    set({
      sortedCards: updated,
      emotionSeries: computeEmotionSeries(updated),
    })
    // DB
    const { updateCard } = await import('@/db/cardRepo')
    await updateCard(cardId, { emotion, intensity })
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

  resetAll: () =>
    set({
      sortedCards: [],
      gaps: [],
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
