import { describe, it, expect } from 'vitest'
import { retagAll, tagEmotion } from './emotionTag'
import type { Card } from '@/types'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    title: '测试',
    content: '内容',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('retagAll - emotionManual 保护', () => {
  it('未标记 emotionManual 的卡片会被自动重新标注', () => {
    const cards = [makeCard({ id: 'c1', content: '甜蜜重逢', emotion: 0, intensity: 1 })]
    const result = retagAll(cards)
    // 「甜蜜」和「重逢」都是正向词，应该被重新标注为正情绪
    expect(result[0].emotion).toBeGreaterThan(0)
  })

  it('标记了 emotionManual 的卡片不会被覆盖', () => {
    const cards = [
      makeCard({
        id: 'c1',
        content: '甜蜜重逢',
        emotion: -4, // 用户手动设为负向，与关键词矛盾
        intensity: 5,
        emotionManual: true,
      }),
    ]
    const result = retagAll(cards)
    // 应该保留用户手动设的值，不被关键词覆盖
    expect(result[0].emotion).toBe(-4)
    expect(result[0].intensity).toBe(5)
  })

  it('混合场景：手动卡片保留，自动卡片重标', () => {
    const cards = [
      makeCard({ id: 'c1', content: '甜蜜', emotion: -3, intensity: 4, emotionManual: true }),
      makeCard({ id: 'c2', content: '心碎分手', emotion: 0, intensity: 1, emotionManual: false }),
    ]
    const result = retagAll(cards)
    expect(result[0].emotion).toBe(-3) // 保留手动值
    expect(result[1].emotion).toBeLessThan(0) // 自动重标为负向
  })

  it('emotionManual 为 undefined 时视为未标记，正常自动标注', () => {
    const cards = [makeCard({ id: 'c1', content: '甜蜜', emotion: 0, intensity: 1 })]
    const result = retagAll(cards)
    expect(result[0].emotion).toBeGreaterThan(0)
  })
})

describe('tagEmotion - 基础标注', () => {
  it('无情绪关键词返回默认 0,1', () => {
    const result = tagEmotion('今天天气不错')
    expect(result.emotion).toBe(0)
    expect(result.intensity).toBe(1)
    expect(result.matched).toEqual([])
  })
})
