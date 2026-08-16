import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { useSortStore } from '@/stores/sortStore'
import { useCardStore } from '@/stores/cardStore'
import { addCard } from '@/db/cardRepo'
import { getAllCharacters } from '@/db/characterRepo'

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
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await addCard({ title: '卡B', content: '中段', stage: 'mid' })
    await addCard({ title: '卡C', content: '结局', stage: 'post' })

    await useSortStore.getState().runSort()
    expect(useSortStore.getState().sortedCards).toHaveLength(3)

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

describe('sortStore - removeCharacter / renameCharacter', () => {
  it('removeCharacter 删除角色', async () => {
    await addCard({ title: '卡A', content: '沈知行和林婉清相遇', stage: 'pre' })
    await useSortStore.getState().runSort()
    await useSortStore.getState().runCharacters()

    const before = useSortStore.getState().characters
    expect(before.length).toBeGreaterThan(0)

    const targetId = before[0].id
    await useSortStore.getState().removeCharacter(targetId)

    const after = useSortStore.getState().characters
    expect(after).toHaveLength(before.length - 1)
    expect(after.find((c) => c.id === targetId)).toBeUndefined()

    // DB 中也删除了
    const dbChars = await getAllCharacters()
    expect(dbChars.find((c) => c.id === targetId)).toBeUndefined()
  })

  it('renameCharacter 修改角色名', async () => {
    await addCard({ title: '卡A', content: '沈知行和林婉清相遇', stage: 'pre' })
    await useSortStore.getState().runSort()
    await useSortStore.getState().runCharacters()

    const targetId = useSortStore.getState().characters[0].id
    const oldName = useSortStore.getState().characters[0].name
    await useSortStore.getState().renameCharacter(targetId, '新名字')

    const updated = useSortStore.getState().characters.find((c) => c.id === targetId)
    expect(updated?.name).toBe('新名字')
    expect(updated?.name).not.toBe(oldName)
  })

  it('renameCharacter 空名不修改', async () => {
    await addCard({ title: '卡A', content: '沈知行和林婉清相遇', stage: 'pre' })
    await useSortStore.getState().runSort()
    await useSortStore.getState().runCharacters()

    const targetId = useSortStore.getState().characters[0].id
    const oldName = useSortStore.getState().characters[0].name
    await useSortStore.getState().renameCharacter(targetId, '  ')

    const updated = useSortStore.getState().characters.find((c) => c.id === targetId)
    expect(updated?.name).toBe(oldName)
  })
})
