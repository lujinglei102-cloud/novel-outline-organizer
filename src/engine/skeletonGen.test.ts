import { describe, it, expect } from 'vitest'
import { computeChapterStats } from './skeletonGen'

describe('computeChapterStats - 章节情绪与伏笔统计', () => {
  it('空卡片列表返回零值', () => {
    const stats = computeChapterStats([])
    expect(stats.cardCount).toBe(0)
    expect(stats.emotions).toEqual([])
    expect(stats.avgEmotion).toBe(0)
    expect(stats.maxEmotion).toBe(0)
    expect(stats.minEmotion).toBe(0)
    expect(stats.foreshadowCount).toBe(0)
    expect(stats.unresolvedForeshadowCount).toBe(0)
  })

  it('正确计算平均/最高/最低情绪值', () => {
    const stats = computeChapterStats([
      { id: 'c1', title: '初见', content: '相遇', emotion: 3, intensity: 2 },
      { id: 'c2', title: '冲突', content: '争吵', emotion: -4, intensity: 5 },
      { id: 'c3', title: '和解', content: '和好', emotion: 5, intensity: 4 },
    ])
    expect(stats.cardCount).toBe(3)
    expect(stats.emotions).toEqual([3, -4, 5])
    expect(stats.avgEmotion).toBe(1.3)
    expect(stats.maxEmotion).toBe(5)
    expect(stats.minEmotion).toBe(-4)
  })

  it('缺失情绪值默认为 0，缺失强度默认为 1', () => {
    const stats = computeChapterStats([
      { id: 'c1', title: '无情绪', content: '内容' },
    ])
    expect(stats.emotions).toEqual([0])
    expect(stats.intensities).toEqual([1])
    expect(stats.avgEmotion).toBe(0)
  })

  it('正确识别伏笔卡片及回收状态', () => {
    const stats = computeChapterStats([
      { id: 'c1', title: '玉佩', content: '埋下玉佩', isForeshadow: true, foreshadowResolved: false },
      { id: 'c2', title: '日常', content: '日常', isForeshadow: false },
      { id: 'c3', title: '信物', content: '挖出信物', isForeshadow: true, foreshadowResolved: true },
    ])
    expect(stats.foreshadowCount).toBe(2)
    expect(stats.unresolvedForeshadowCount).toBe(1)
    expect(stats.foreshadowCards).toHaveLength(2)
    expect(stats.foreshadowCards[0].resolved).toBe(false)
    expect(stats.foreshadowCards[1].resolved).toBe(true)
  })

  it('无标题卡片显示（无标题）', () => {
    const stats = computeChapterStats([
      { id: 'c1', content: '内容', isForeshadow: true },
    ])
    expect(stats.foreshadowCards[0].title).toBe('（无标题）')
  })

  it('全部伏笔已回收时未回收数为 0', () => {
    const stats = computeChapterStats([
      { id: 'c1', title: '伏笔A', content: 'a', isForeshadow: true, foreshadowResolved: true },
      { id: 'c2', title: '伏笔B', content: 'b', isForeshadow: true, foreshadowResolved: true },
    ])
    expect(stats.foreshadowCount).toBe(2)
    expect(stats.unresolvedForeshadowCount).toBe(0)
  })
})
