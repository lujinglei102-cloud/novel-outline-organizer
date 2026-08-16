import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { useSortStore } from '@/stores/sortStore'
import { useCardStore } from '@/stores/cardStore'
import { addCard } from '@/db/cardRepo'

beforeEach(async () => {
  const db = new AppDatabase()
  setDatabase(db)
  await db.cards.clear()
  await db.characters.clear()
  await db.links.clear()
  await db.chapters.clear()
  useSortStore.setState({
    sortedCards: [],
    gaps: [],
    turningPoints: [],
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
  })
  useCardStore.setState({ cards: [], filterCharacterId: null, filterBookId: null })
})

describe('sortStore - reorderCards', () => {
  it('拖拽后卡片顺序正确改变', async () => {
    // 准备测试数据
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await addCard({ title: '卡B', content: '中段', stage: 'mid' })
    await addCard({ title: '卡C', content: '结局', stage: 'post' })

    // 排序
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().sortedCards).toHaveLength(3)

    // 把第0张拖到第2位
    const firstId = useSortStore.getState().sortedCards[0].id
    await useSortStore.getState().reorderCards(0, 2)

    const reordered = useSortStore.getState().sortedCards
    expect(reordered).toHaveLength(3)
    expect(reordered[2].id).toBe(firstId)
  })

  it('拖拽后 order 字段按新顺序更新', async () => {
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await addCard({ title: '卡B', content: '中段', stage: 'mid' })
    await addCard({ title: '卡C', content: '结局', stage: 'post' })

    await useSortStore.getState().runSort()
    await useSortStore.getState().reorderCards(2, 0)

    const reordered = useSortStore.getState().sortedCards
    expect(reordered[0].order).toBe(0)
    expect(reordered[1].order).toBe(100)
    expect(reordered[2].order).toBe(200)
  })

  it('无效索引不报错', async () => {
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await useSortStore.getState().runSort()
    await useSortStore.getState().reorderCards(-1, 99)
    expect(useSortStore.getState().sortedCards).toHaveLength(1)
  })
})
