import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { useSortStore } from '@/stores/sortStore'
import { useCardStore } from '@/stores/cardStore'
import { addCard } from '@/db/cardRepo'
import { getAllCharacters } from '@/db/characterRepo'
import { getAllLinks } from '@/db/linkRepo'

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
    lastSortCache: null,
    lastCacheHit: false,
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
  // 角色需要 mentionCount >= 2 才会被识别，所以每个角色至少出现 2 次
  it('removeCharacter 删除角色', async () => {
    await addCard({ title: '卡A', content: '沈知行和林婉清相遇', stage: 'pre' })
    await addCard({ title: '卡B', content: '沈知行再次见到林婉清', stage: 'mid' })
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
    await addCard({ title: '卡B', content: '沈知行再次见到林婉清', stage: 'mid' })
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
    await addCard({ title: '卡B', content: '沈知行再次见到林婉清', stage: 'mid' })
    await useSortStore.getState().runSort()
    await useSortStore.getState().runCharacters()

    const targetId = useSortStore.getState().characters[0].id
    const oldName = useSortStore.getState().characters[0].name
    await useSortStore.getState().renameCharacter(targetId, '  ')

    const updated = useSortStore.getState().characters.find((c) => c.id === targetId)
    expect(updated?.name).toBe(oldName)
  })
})

describe('sortStore - toggleForeshadowCard', () => {
  it('切换手动伏笔的回收状态（未回收→已回收）', async () => {
    await addCard({
      title: '玉佩伏笔',
      content: '女主把玉佩埋在树下',
      stage: 'pre',
      isForeshadow: true,
    })
    await useSortStore.getState().runSort()

    const card = useSortStore.getState().sortedCards[0]
    expect(card.isForeshadow).toBe(true)
    expect(card.foreshadowResolved).toBeFalsy()

    await useSortStore.getState().toggleForeshadowCard(card.id)

    const updated = useSortStore.getState().sortedCards.find((c) => c.id === card.id)
    expect(updated?.foreshadowResolved).toBe(true)
  })

  it('已回收可再次切换回未回收', async () => {
    await addCard({
      title: '玉佩伏笔',
      content: '女主把玉佩埋在树下',
      stage: 'pre',
      isForeshadow: true,
    })
    await useSortStore.getState().runSort()

    const cardId = useSortStore.getState().sortedCards[0].id
    await useSortStore.getState().toggleForeshadowCard(cardId)
    expect(
      useSortStore.getState().sortedCards.find((c) => c.id === cardId)?.foreshadowResolved,
    ).toBe(true)

    await useSortStore.getState().toggleForeshadowCard(cardId)
    expect(
      useSortStore.getState().sortedCards.find((c) => c.id === cardId)?.foreshadowResolved,
    ).toBe(false)
  })

  it('对不存在于 sortedCards 的 id 调用不报错', async () => {
    await useSortStore.getState().toggleForeshadowCard('not-exist')
    expect(useSortStore.getState().sortedCards).toHaveLength(0)
  })
})

describe('sortStore - toggleLinkResolved', () => {
  it('切换自动伏笔关联的回收状态', async () => {
    // 两条卡片都包含同一信物「玉佩」，触发自动伏笔关联
    await addCard({ title: '埋下伏笔', content: '女主把玉佩埋在树下', stage: 'pre' })
    await addCard({ title: '回收伏笔', content: '男主挖出当年的玉佩', stage: 'post' })
    await useSortStore.getState().runSort()
    await useSortStore.getState().runLinks()

    const links = useSortStore.getState().links
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].resolved).toBeFalsy()

    const linkId = links[0].id
    await useSortStore.getState().toggleLinkResolved(linkId)

    const updated = useSortStore.getState().links.find((l) => l.id === linkId)
    expect(updated?.resolved).toBe(true)

    // DB 中也持久化了
    const dbLinks = await getAllLinks()
    expect(dbLinks.find((l) => l.id === linkId)?.resolved).toBe(true)
  })
})

describe('sortStore - refreshEmotionSeries', () => {
  it('只用当前 sortedCards 情绪值刷新曲线，不重新标注', async () => {
    await addCard({ title: '卡A', content: '甜蜜重逢', stage: 'pre', emotion: 3, intensity: 4, emotionManual: true })
    await addCard({ title: '卡B', content: '心碎分手', stage: 'post', emotion: -5, intensity: 5, emotionManual: true })
    await useSortStore.getState().runSort()

    // sortedCards 保留了手动情绪值
    const sorted = useSortStore.getState().sortedCards
    expect(sorted[0].emotion).toBe(3)
    expect(sorted[1].emotion).toBe(-5)

    // refreshEmotionSeries 不改变 sortedCards 的情绪值
    useSortStore.getState().refreshEmotionSeries()
    const after = useSortStore.getState().sortedCards
    expect(after[0].emotion).toBe(3)
    expect(after[1].emotion).toBe(-5)

    // emotionSeries 反映当前情绪值
    const series = useSortStore.getState().emotionSeries
    expect(series).toHaveLength(2)
    expect(series.find((p) => p.cardId === sorted[0].id)?.y).toBe(3)
    expect(series.find((p) => p.cardId === sorted[1].id)?.y).toBe(-5)
  })

  it('refreshEmotionSeries 与 runEmotionRetag 区别：前者不覆盖手动值', async () => {
    await addCard({ title: '卡A', content: '甜蜜', stage: 'pre', emotion: -2, intensity: 3, emotionManual: true })
    await useSortStore.getState().runSort()

    // refreshEmotionSeries 保留手动值 -2
    useSortStore.getState().refreshEmotionSeries()
    expect(useSortStore.getState().sortedCards[0].emotion).toBe(-2)

    // runEmotionRetag 也应该保留手动值（因为 emotionManual=true）
    await useSortStore.getState().runEmotionRetag()
    expect(useSortStore.getState().sortedCards[0].emotion).toBe(-2)
  })
})

describe('sortStore - restoreManualEmotion', () => {
  it('自动补标后恢复手动标注值', async () => {
    // 卡片没有 emotionManual，自动补标会改变情绪值
    await addCard({ title: '卡A', content: '甜蜜', stage: 'pre', emotion: 0, intensity: 1 })
    await useSortStore.getState().runSort()

    // 自动补标前，情绪为 0（DB 中的值）
    expect(useSortStore.getState().sortedCards[0].emotion).toBe(0)

    // 自动补标后，甜蜜 → 正情绪
    await useSortStore.getState().runEmotionRetag()
    expect(useSortStore.getState().sortedCards[0].emotion).toBeGreaterThan(0)

    // 恢复手动标注：从 DB 重新加载，情绪回到 0
    await useSortStore.getState().restoreManualEmotion()
    expect(useSortStore.getState().sortedCards[0].emotion).toBe(0)
  })

  it('恢复后保持当前排序顺序不变', async () => {
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await addCard({ title: '卡B', content: '结局', stage: 'post' })
    await useSortStore.getState().runSort()

    const orderBefore = useSortStore.getState().sortedCards.map((c) => c.id)
    await useSortStore.getState().runEmotionRetag()
    await useSortStore.getState().restoreManualEmotion()
    const orderAfter = useSortStore.getState().sortedCards.map((c) => c.id)
    expect(orderAfter).toEqual(orderBefore)
  })
})

describe('sortStore - 梳理结果缓存 (T3.8)', () => {
  it('同批卡片未改时二次梳理命中缓存（秒出）', async () => {
    await addCard({ title: '卡A', content: '沈知行初见玉佩', stage: 'pre' })
    await addCard({ title: '卡B', content: '沈知行雨夜重逢', stage: 'mid' })

    // 第一次梳理：未命中缓存，重新计算
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastCacheHit).toBe(false)
    expect(useSortStore.getState().lastSortCache).not.toBeNull()
    const firstSortedAt = useSortStore.getState().sortedAt
    expect(firstSortedAt).not.toBeNull()

    // 第二次梳理：同批卡片未改 → 命中缓存
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastCacheHit).toBe(true)
    // sortedAt 应该保持第一次的时间（从缓存恢复）
    expect(useSortStore.getState().sortedAt).toBe(firstSortedAt)
  })

  it('编辑卡片后缓存自动失效，重新计算', async () => {
    await addCard({ title: '卡A', content: '初见沈知行', stage: 'pre' })
    await addCard({ title: '卡B', content: '中段', stage: 'mid' })
    // 把 DB 中的卡片加载到 cardStore state（cardStore.edit 会同步到 sortStore）
    await useCardStore.getState().loadAll()

    // 第一次梳理
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastCacheHit).toBe(false)
    const firstFingerprint = useSortStore.getState().lastSortCache?.fingerprint
    expect(firstFingerprint).toBeTruthy()

    // 通过 cardStore.edit 编辑卡片内容 → 自动失效缓存
    const cardA = useCardStore.getState().cards[0]
    expect(cardA).toBeDefined()
    await useCardStore.getState().edit(cardA.id, { content: '初见沈知行，玉佩为信物' })
    expect(useSortStore.getState().lastSortCache).toBeNull()

    // 第二次梳理：缓存已失效，重新计算
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastCacheHit).toBe(false)
    // 指纹应变化（因为 content 长度变了）
    const secondFingerprint = useSortStore.getState().lastSortCache?.fingerprint
    expect(secondFingerprint).not.toBe(firstFingerprint)
  })

  it('删除卡片后缓存自动失效', async () => {
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await addCard({ title: '卡B', content: '中段', stage: 'mid' })
    await addCard({ title: '卡C', content: '结局', stage: 'post' })
    await useCardStore.getState().loadAll()

    await useSortStore.getState().runSort()
    expect(useSortStore.getState().sortedCards).toHaveLength(3)
    expect(useSortStore.getState().lastSortCache).not.toBeNull()

    // 删除一张卡片 → 缓存失效
    const cardA = useCardStore.getState().cards[0]
    expect(cardA).toBeDefined()
    await useCardStore.getState().remove(cardA.id)
    expect(useSortStore.getState().lastSortCache).toBeNull()

    // 重新梳理后只有 2 张
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().sortedCards).toHaveLength(2)
    expect(useSortStore.getState().lastCacheHit).toBe(false)
  })

  it('手动改情绪值后缓存失效', async () => {
    await addCard({ title: '卡A', content: '甜蜜', stage: 'pre', emotion: 0, intensity: 1 })
    await useSortStore.getState().runSort()

    // 手动改情绪 → 缓存失效（指纹中含 emotion 字段）
    const cardId = useSortStore.getState().sortedCards[0].id
    await useSortStore.getState().saveTagToCard(cardId, 5, 4)
    expect(useSortStore.getState().lastSortCache).toBeNull()

    // 重新梳理会用新的情绪值
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastCacheHit).toBe(false)
    expect(useSortStore.getState().sortedCards[0].emotion).toBe(5)
  })

  it('reorderCards 后缓存失效', async () => {
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await addCard({ title: '卡B', content: '中段', stage: 'mid' })
    await addCard({ title: '卡C', content: '结局', stage: 'post' })

    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastSortCache).not.toBeNull()

    await useSortStore.getState().reorderCards(0, 2)
    expect(useSortStore.getState().lastSortCache).toBeNull()
  })

  it('invalidateCache 手动失效缓存', async () => {
    await addCard({ title: '卡A', content: '初见', stage: 'pre' })
    await useSortStore.getState().runSort()
    expect(useSortStore.getState().lastSortCache).not.toBeNull()

    useSortStore.getState().invalidateCache()
    expect(useSortStore.getState().lastSortCache).toBeNull()
    expect(useSortStore.getState().lastCacheHit).toBe(false)
  })

  it('runCharacters 命中缓存时跳过重算', async () => {
    await addCard({ title: '卡A', content: '沈知行初见玉佩', stage: 'pre' })
    await addCard({ title: '卡B', content: '沈知行雨夜重逢', stage: 'mid' })

    // 第一次 runSort 会一并计算角色并写入缓存
    await useSortStore.getState().runSort()
    const charsAfterFirstSort = useSortStore.getState().characters
    expect(charsAfterFirstSort.length).toBeGreaterThan(0)

    // 直接调 runCharacters 应命中缓存
    await useSortStore.getState().runCharacters()
    expect(useSortStore.getState().lastCacheHit).toBe(true)
    // 角色列表与第一次一致
    expect(useSortStore.getState().characters).toEqual(charsAfterFirstSort)
  })

  it('runLinks 命中缓存时跳过重算', async () => {
    await addCard({ title: '卡A', content: '玉佩为信物', stage: 'pre' })
    await addCard({ title: '卡B', content: '玉佩被摔碎', stage: 'post' })

    await useSortStore.getState().runSort()
    const linksAfterFirstSort = useSortStore.getState().links

    // 直接调 runLinks 应命中缓存
    await useSortStore.getState().runLinks()
    expect(useSortStore.getState().lastCacheHit).toBe(true)
    expect(useSortStore.getState().links).toEqual(linksAfterFirstSort)
  })
})
