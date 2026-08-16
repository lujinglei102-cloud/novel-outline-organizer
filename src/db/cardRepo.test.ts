import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { addCard, getAllCards, updateCard, deleteCard, getCard } from '@/db/cardRepo'

let db: AppDatabase

beforeEach(async () => {
  db = new AppDatabase()
  setDatabase(db)
  await db.cards.clear()
})

describe('cardRepo', () => {
  it('新增卡片并读取', async () => {
    const card = await addCard({ content: '测试灵感' })
    expect(card.id).toBeTruthy()
    expect(card.content).toBe('测试灵感')
    const all = await getAllCards()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(card.id)
  })

  it('内容超过500字被截断', async () => {
    const long = 'b'.repeat(600)
    const card = await addCard({ content: long })
    expect(card.content).toHaveLength(500)
  })

  it('默认 stage 为 none', async () => {
    const card = await addCard({ content: 'x' })
    expect(card.stage).toBe('none')
  })

  it('默认 emotion=0 intensity=1', async () => {
    const card = await addCard({ content: 'x' })
    expect(card.emotion).toBe(0)
    expect(card.intensity).toBe(1)
  })

  it('更新卡片字段', async () => {
    const card = await addCard({ content: '原内容' })
    await updateCard(card.id, { content: '新内容', stage: 'pre', emotion: -3 })
    const updated = await getCard(card.id)
    expect(updated?.content).toBe('新内容')
    expect(updated?.stage).toBe('pre')
    expect(updated?.emotion).toBe(-3)
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(card.updatedAt)
  })

  it('删除卡片', async () => {
    const card = await addCard({ content: '待删除' })
    await deleteCard(card.id)
    const all = await getAllCards()
    expect(all).toHaveLength(0)
  })

  it('关联角色写入', async () => {
    const card = await addCard({ content: 'x', characterId: 'char1' })
    expect(card.characterId).toBe('char1')
    const got = await getCard(card.id)
    expect(got?.characterId).toBe('char1')
  })
})
