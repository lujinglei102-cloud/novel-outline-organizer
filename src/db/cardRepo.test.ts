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
  it('新增卡片并读取标题和正文', async () => {
    const card = await addCard({ title: '初遇', content: '测试灵感' })
    expect(card.id).toBeTruthy()
    expect(card.title).toBe('初遇')
    expect(card.content).toBe('测试灵感')
    const all = await getAllCards()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(card.id)
  })

  it('标题超过100字被截断', async () => {
    const long = 'b'.repeat(120)
    const card = await addCard({ title: long, content: 'x' })
    expect(card.title).toHaveLength(100)
  })

  it('正文超过500字被截断', async () => {
    const long = 'b'.repeat(600)
    const card = await addCard({ title: 't', content: long })
    expect(card.content).toHaveLength(500)
  })

  it('默认 stage 为 none', async () => {
    const card = await addCard({ title: 't', content: 'x' })
    expect(card.stage).toBe('none')
  })

  it('默认 emotion=0 intensity=1', async () => {
    const card = await addCard({ title: 't', content: 'x' })
    expect(card.emotion).toBe(0)
    expect(card.intensity).toBe(1)
  })

  it('更新卡片标题和正文', async () => {
    const card = await addCard({ title: '原标题', content: '原内容' })
    await updateCard(card.id, { title: '新标题', content: '新内容', stage: 'pre', emotion: -3 })
    const updated = await getCard(card.id)
    expect(updated?.title).toBe('新标题')
    expect(updated?.content).toBe('新内容')
    expect(updated?.stage).toBe('pre')
    expect(updated?.emotion).toBe(-3)
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(card.updatedAt)
  })

  it('删除卡片', async () => {
    const card = await addCard({ title: 't', content: '待删除' })
    await deleteCard(card.id)
    const all = await getAllCards()
    expect(all).toHaveLength(0)
  })

  it('关联角色写入', async () => {
    const card = await addCard({ title: 't', content: 'x', characterId: 'char1' })
    expect(card.characterId).toBe('char1')
    const got = await getCard(card.id)
    expect(got?.characterId).toBe('char1')
  })

  it('isForeshadow 默认 false', async () => {
    const card = await addCard({ title: 't', content: 'x' })
    expect(card.isForeshadow).toBe(false)
  })

  it('isForeshadow 可设置为 true', async () => {
    const card = await addCard({ title: '伏笔卡', content: '玉佩的秘密', isForeshadow: true })
    expect(card.isForeshadow).toBe(true)
    const got = await getCard(card.id)
    expect(got?.isForeshadow).toBe(true)
  })

  it('emotion 和 intensity 可在创建时指定', async () => {
    const card = await addCard({ title: 't', content: 'x', emotion: -4, intensity: 3 })
    expect(card.emotion).toBe(-4)
    expect(card.intensity).toBe(3)
  })
})
