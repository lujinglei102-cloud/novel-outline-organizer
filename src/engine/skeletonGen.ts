import type { Card, Template, Chapter } from '@/types'
import { TEMPLATES } from '../data/templates'

export interface Boundary {
  nodeIndex: number // 对应 nodes[nodeIndex] 段从这个 index 开头的卡片起
  afterCardIndex: number // 分界线插在 cards[afterCardIndex] 之后；-1 表示在最前面
}

export interface SkeletonDirection {
  id: string
  templateId: string
  templateName: string
  reason: string // 该方向的简介
  boundaries: Boundary[] // 长度 = template.nodes.length，最后一个 afterCardIndex = cards.length-1
  anchorAssignments: { anchorName: string; cardIndex: number }[] // 锚点建议分配到哪张卡片
}

/**
 * 生成 2-3 条骨架方向。纯规则：
 * 1. 基于不同模板生成（每个模板 1 条方向）
 * 2. 如果只有 1 个模板可选，则在同一模板下生成「破裂点偏前」「破裂点居中」2 条方向
 */
export function generateSkeletonDirections(
  sortedCards: Card[],
  preferredTemplateIds: string[] = TEMPLATES.slice(0, 3).map((t) => t.id),
): SkeletonDirection[] {
  if (sortedCards.length === 0) return []
  const N = sortedCards.length
  const result: SkeletonDirection[] = []
  const templates = preferredTemplateIds
    .map((id) => TEMPLATES.find((t) => t.id === id))
    .filter((t): t is Template => !!t)
    .slice(0, 2) // 最多用 2 个模板各出一条

  for (const tpl of templates) {
    result.push(buildDirection(tpl, N, 'default'))
  }

  // 若只生成了 1 条，加同模板的变体
  if (result.length === 1) {
    const tpl = TEMPLATES.find((t) => t.id === result[0].templateId)
    if (tpl) result.push(buildDirection(tpl, N, 'variant'))
  }

  return result
}

function buildDirection(
  tpl: Template,
  N: number,
  variant: 'default' | 'variant',
): SkeletonDirection {
  const nodes = tpl.nodes
  const segments = nodes.length
  // 按模板理想情绪或默认「每段比例均衡 1/segments 每张」来分
  const ratios: number[] = new Array(segments).fill(1 / segments)
  // 轻微偏移：variant 让第二段（转/破裂点）前移或后移
  if (variant === 'variant' && segments === 4) {
    ratios[0] = 0.15; ratios[1] = 0.2; ratios[2] = 0.4; ratios[3] = 0.25
  } else if (segments === 4) {
    ratios[0] = 0.25; ratios[1] = 0.25; ratios[2] = 0.3; ratios[3] = 0.2
  }
  // 归一化
  const rsum = ratios.reduce((a, b) => a + b, 0)
  for (let i = 0; i < ratios.length; i++) ratios[i] /= rsum

  let cumulative = 0
  const boundaries: Boundary[] = []
  for (let i = 0; i < segments; i++) {
    cumulative += ratios[i]
    // 第 i 段的结束位置
    const endFloat = Math.round(cumulative * N) - 1
    const endIndex = i === segments - 1 ? N - 1 : Math.max(i, Math.min(N - 1 - (segments - 1 - i), endFloat))
    boundaries.push({ nodeIndex: i, afterCardIndex: endIndex })
  }

  // 锚点建议：每个锚点分配到对应段中间偏右的位置
  const anchorAssignments: { anchorName: string; cardIndex: number }[] = []
  for (let i = 0; i < tpl.anchors.length; i++) {
    const anchor = tpl.anchors[i]
    const segIdx = Math.min(segments - 1, Math.floor((i + 1) * segments / (tpl.anchors.length + 1)))
    const start = segIdx === 0 ? 0 : (boundaries[segIdx - 1].afterCardIndex + 1)
    const end = boundaries[segIdx].afterCardIndex
    const pick = Math.max(start, Math.min(end, Math.floor((start + end) / 2)))
    anchorAssignments.push({ anchorName: anchor.name, cardIndex: pick })
  }

  const reason =
    variant === 'default'
      ? `按《${tpl.name}》默认比例分段（${ratios.map((r) => Math.round(r * 100) + '%').join('/')}），锚点均匀落在关键段`
      : `变体：《${tpl.name}》冲突点后移，给前段铺垫留更多空间`

  return {
    id: `dir-${tpl.id}-${variant}-${Date.now().toString(36)}`,
    templateId: tpl.id,
    templateName: tpl.name,
    reason,
    boundaries,
    anchorAssignments,
  }
}

/**
 * 段落内章节自动拆分：
 * <=3 张 -> 1 章；4-6 张 -> 2 章；>=7 张 -> 3 章
 */
export function splitIntoChapters(
  sortedCards: Card[],
  boundaries: Boundary[],
  template: Template,
  perNode?: number,
): Chapter[] {
  const chapters: Chapter[] = []
  let chIdx = 1
  for (let seg = 0; seg < boundaries.length; seg++) {
    const start = seg === 0 ? 0 : boundaries[seg - 1].afterCardIndex + 1
    const end = boundaries[seg].afterCardIndex
    const segCards = sortedCards.slice(start, end + 1)
    const nCards = segCards.length
    let chapterCount = perNode ?? 1
    if (perNode === undefined) {
      if (nCards >= 7) chapterCount = 3
      else if (nCards >= 4) chapterCount = 2
    }

    const perChapter = Math.floor(nCards / chapterCount)
    let idx = 0
    for (let c = 0; c < chapterCount; c++) {
      const take = c === chapterCount - 1 ? nCards - idx : perChapter
      const cardIds = segCards.slice(idx, idx + take).map((x) => x.id)
      chapters.push({
        id: 'ch-' + chIdx,
        index: chIdx,
        title: `第 ${chIdx} 章`,
        conflict: `【${template.nodes[seg]}】${
          cardIds.length > 0 ? sortedCards[start + idx].content.slice(0, 20) + '…' : '待补充冲突描述'
        }`,
        cardIds,
        nodeId: template.nodes[seg],
      })
      idx += take
      chIdx += 1
    }
  }
  return chapters
}

/**
 * 章节情绪与伏笔统计：根据章节内的卡片计算情绪概览和伏笔标注。
 * 用于「章节情绪起伏 + 伏笔标注」查看面板。
 */
export interface ChapterStats {
  cardCount: number
  emotions: number[]
  intensities: number[]
  avgEmotion: number
  maxEmotion: number
  minEmotion: number
  foreshadowCards: { id: string; title: string; content: string; resolved: boolean }[]
  foreshadowCount: number
  unresolvedForeshadowCount: number
}

export function computeChapterStats(
  cards: { id: string; title?: string; content: string; emotion?: number; intensity?: number; isForeshadow?: boolean; foreshadowResolved?: boolean }[],
): ChapterStats {
  const emotions = cards.map((c) => c.emotion ?? 0)
  const intensities = cards.map((c) => c.intensity ?? 1)
  const foreshadowCards = cards
    .filter((c) => c.isForeshadow)
    .map((c) => ({
      id: c.id,
      title: c.title?.trim() || '（无标题）',
      content: c.content,
      resolved: !!c.foreshadowResolved,
    }))

  const sum = emotions.reduce((a, b) => a + b, 0)
  return {
    cardCount: cards.length,
    emotions,
    intensities,
    avgEmotion: emotions.length > 0 ? Math.round((sum / emotions.length) * 10) / 10 : 0,
    maxEmotion: emotions.length > 0 ? Math.max(...emotions) : 0,
    minEmotion: emotions.length > 0 ? Math.min(...emotions) : 0,
    foreshadowCards,
    foreshadowCount: foreshadowCards.length,
    unresolvedForeshadowCount: foreshadowCards.filter((f) => !f.resolved).length,
  }
}
