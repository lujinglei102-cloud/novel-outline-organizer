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
    const card = await useCardStore.getState().create({ title: '标题A', content: '灵感A' })
    expect(useCardStore.getState().cards).toHaveLength(1)
    expect(useCardStore.getState().cards[0].id).toBe(card.id)
    expect(useCardStore.getState().cards[0].title).toBe('标题A')
  })

  it('edit 更新标题和内容', async () => {
    const card = await useCardStore.getState().create({ title: '原标题', content: '原' })
    await useCardStore.getState().edit(card.id, { title: '新标题', content: '改' })
    expect(useCardStore.getState().cards[0].title).toBe('新标题')
    expect(useCardStore.getState().cards[0].content).toBe('改')
  })

  it('remove 删除卡片', async () => {
    const card = await useCardStore.getState().create({ title: 't', content: 'x' })
    await useCardStore.getState().remove(card.id)
    expect(useCardStore.getState().cards).toHaveLength(0)
  })

  it('visibleCards 按时间倒序', async () => {
    await useCardStore.getState().create({ title: '早', content: '早' })
    await new Promise((r) => setTimeout(r, 5))
    await useCardStore.getState().create({ title: '晚', content: '晚' })
    const visible = useCardStore.getState().visibleCards()
    expect(visible[0].title).toBe('晚')
    expect(visible[1].title).toBe('早')
  })

  it('setFilter 后只显示对应角色卡片', async () => {
    await useCardStore.getState().create({ title: 'A', content: 'A', characterId: 'c1' })
    await useCardStore.getState().create({ title: 'B', content: 'B', characterId: 'c2' })
    useCardStore.getState().setFilter('c1')
    const visible = useCardStore.getState().visibleCards()
    expect(visible).toHaveLength(1)
    expect(visible[0].title).toBe('A')
  })

  it('loadAll 从 DB 读取持久化数据', async () => {
    await useCardStore.getState().create({ title: '持久化', content: '持久化' })
    useCardStore.setState({ cards: [] })
    await useCardStore.getState().loadAll()
    expect(useCardStore.getState().cards).toHaveLength(1)
    expect(useCardStore.getState().cards[0].title).toBe('持久化')
  })
})
