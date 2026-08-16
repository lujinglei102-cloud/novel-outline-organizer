import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { useCardStore } from '@/stores/cardStore'

beforeEach(async () => {
  const db = new AppDatabase()
  setDatabase(db)
  await db.cards.clear()
  useCardStore.setState({ cards: [], filterCharacterId: null })
})

describe('cardStore', () => {
  it('create 后列表包含新卡片', async () => {
    const card = await useCardStore.getState().create({ content: '灵感A' })
    expect(useCardStore.getState().cards).toHaveLength(1)
    expect(useCardStore.getState().cards[0].id).toBe(card.id)
  })

  it('edit 更新内容', async () => {
    const card = await useCardStore.getState().create({ content: '原' })
    await useCardStore.getState().edit(card.id, { content: '改' })
    expect(useCardStore.getState().cards[0].content).toBe('改')
  })

  it('remove 删除卡片', async () => {
    const card = await useCardStore.getState().create({ content: 'x' })
    await useCardStore.getState().remove(card.id)
    expect(useCardStore.getState().cards).toHaveLength(0)
  })

  it('visibleCards 按时间倒序', async () => {
    await useCardStore.getState().create({ content: '早' })
    await new Promise((r) => setTimeout(r, 5))
    await useCardStore.getState().create({ content: '晚' })
    const visible = useCardStore.getState().visibleCards()
    expect(visible[0].content).toBe('晚')
    expect(visible[1].content).toBe('早')
  })

  it('setFilter 后只显示对应角色卡片', async () => {
    await useCardStore.getState().create({ content: 'A', characterId: 'c1' })
    await useCardStore.getState().create({ content: 'B', characterId: 'c2' })
    useCardStore.getState().setFilter('c1')
    const visible = useCardStore.getState().visibleCards()
    expect(visible).toHaveLength(1)
    expect(visible[0].content).toBe('A')
  })

  it('loadAll 从 DB 读取持久化数据', async () => {
    await useCardStore.getState().create({ content: '持久化' })
    useCardStore.setState({ cards: [] })
    await useCardStore.getState().loadAll()
    expect(useCardStore.getState().cards).toHaveLength(1)
    expect(useCardStore.getState().cards[0].content).toBe('持久化')
  })
})
