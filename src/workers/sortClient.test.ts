import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { computeSortSync, runSortInWorker } from '@/workers/sortClient'
import type { Card } from '@/types'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c-' + Math.random().toString(36).slice(2, 10),
    title: '',
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  setDatabase(new AppDatabase())
})

describe('sortClient - computeSortSync', () => {
  it('空卡片数组返回空结果', () => {
    const r = computeSortSync([])
    expect(r.sortedCards).toHaveLength(0)
    expect(r.gaps).toHaveLength(0)
    expect(r.turningPoints).toHaveLength(0)
    expect(r.characters).toHaveLength(0)
    expect(r.links).toHaveLength(0)
    expect(r.emotionSeries).toHaveLength(0)
    expect(r.cardCharacterMapEntries).toHaveLength(0)
  })

  it('按阶段+关键词排序叙事线', () => {
    const cards = [
      makeCard({ id: 'a', title: '卡A', content: '结局', stage: 'post' }),
      makeCard({ id: 'b', title: '卡B', content: '初见', stage: 'pre' }),
      makeCard({ id: 'c', title: '卡C', content: '中段', stage: 'mid' }),
    ]
    const r = computeSortSync(cards)
    expect(r.sortedCards).toHaveLength(3)
    // 前期应在最前，后期应在最后
    expect(r.sortedCards[0].stage).toBe('pre')
    expect(r.sortedCards[2].stage).toBe('post')
  })

  it('情绪曲线按排序后顺序生成 x 轴', () => {
    const cards = [
      makeCard({ id: 'a', emotion: 1 }),
      makeCard({ id: 'b', emotion: -2 }),
      makeCard({ id: 'c', emotion: 3 }),
    ]
    const r = computeSortSync(cards)
    expect(r.emotionSeries).toHaveLength(3)
    r.emotionSeries.forEach((p, i) => expect(p.x).toBe(i))
    expect(r.emotionSeries.map((p) => p.cardId)).toEqual(
      r.sortedCards.map((c) => c.id),
    )
  })

  it('角色识别结果转换为 entries 数组（可序列化）', () => {
    const cards = [
      makeCard({ id: 'a', content: '沈知行和林婉清相遇', stage: 'pre' }),
      makeCard({ id: 'b', content: '沈知行再次见到林婉清', stage: 'mid' }),
    ]
    const r = computeSortSync(cards)
    expect(r.characters.length).toBeGreaterThan(0)
    // entries 数组应该可以重建 Map
    const map = new Map(r.cardCharacterMapEntries)
    expect(map.size).toBe(r.cardCharacterMapEntries.length)
  })

  it('伏笔关联结果与同步计算一致', () => {
    const cards = [
      makeCard({ id: 'a', content: '玉佩是定情信物', stage: 'pre', isForeshadow: true }),
      makeCard({ id: 'b', content: '玉佩的真相', stage: 'post' }),
    ]
    const r = computeSortSync(cards)
    expect(Array.isArray(r.links)).toBe(true)
  })
})

describe('sortClient - runSortInWorker', () => {
  it('在 jsdom 测试环境下自动回退到同步计算', async () => {
    const cards = [
      makeCard({ id: 'a', content: '初见', stage: 'pre' }),
      makeCard({ id: 'b', content: '结局', stage: 'post' }),
    ]
    const result = await runSortInWorker(cards)
    expect(result.sortedCards).toHaveLength(2)
    expect(result.sortedCards[0].stage).toBe('pre')
    expect(result.sortedCards[1].stage).toBe('post')
  })

  it('回退结果与直接调用 computeSortSync 一致', async () => {
    const cards = [
      makeCard({ id: 'a', content: '初见', stage: 'pre' }),
      makeCard({ id: 'b', content: '结局', stage: 'post' }),
    ]
    const sync = computeSortSync(cards)
    const viaWorker = await runSortInWorker(cards)
    expect(viaWorker.sortedCards.map((c) => c.id)).toEqual(
      sync.sortedCards.map((c) => c.id),
    )
    expect(viaWorker.emotionSeries).toEqual(sync.emotionSeries)
  })
})
