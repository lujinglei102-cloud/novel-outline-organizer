import type { Card } from '@/types'

// 阶段权重（前期 < 中期 < 后期）
const stageWeight: Record<string, number> = {
  pre: 0,
  mid: 0.5,
  post: 1,
  none: 0.3,
}

// 排序关键词：匹配到会影响叙事顺序
const earlyKeywords = ['开始','初见','初遇','小时候','从前','出生','相遇','初识','第一次','回忆','前世','重生前']
const lateKeywords = ['结局','最后','终章','多年后','结局','尾声','落幕','老去','死去','临死','终于','最后']

function contentScore(content: string): number {
  let score = 0
  for (const kw of earlyKeywords) if (content.includes(kw)) { score -= 0.2; break }
  for (const kw of lateKeywords) if (content.includes(kw)) { score += 0.2; break }
  return score
}

export interface SortGap {
  afterIndex: number
  afterCardId: string | null
  hint: string
  density: 'sparse' | 'dense' | null
}

export interface SortLineResult {
  cards: Card[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
}

export interface TurningPoint {
  afterCardId: string
  type: 'stage_transition' | 'emotion_shift' | 'score_gap'
  hint: string
  severity: 'high' | 'medium' | 'low'
}

// 转折事件关键词：如果卡片中包含这些词，说明有明确的转折
const turningKeywords = [
  '但是', '然而', '突然', '可是', '不料', '没想到', '意外', '转折',
  '决定', '改变', '离开', '背叛', '真相', '发现', '揭露', '崩溃',
  '重逢', '和解', '决裂', '死亡', '复活', '失忆', '恢复记忆',
]

/**
 * 检测转折事件：识别主角动机过渡是否缺失
 * 三种检测策略：
 * 1. 阶段跳跃：pre→post 跳过 mid，或 mid→none 缺失过渡
 * 2. 情绪翻转：相邻卡片情绪值正负反转且差值 > 4
 * 3. 分数间距：排序后相邻卡片 score 差距过大且无转折关键词
 */
function detectTurningPoints(
  sorted: Card[],
  scored: { card: Card; score: number; origIndex: number }[],
): TurningPoint[] {
  const points: TurningPoint[] = []
  const seen = new Set<string>()

  for (let i = 0; i < sorted.length - 1; i++) {
    const cardA = sorted[i]
    const cardB = sorted[i + 1]
    const stageA = cardA.stage ?? 'none'
    const stageB = cardB.stage ?? 'none'
    const emoA = cardA.emotion ?? 0
    const emoB = cardB.emotion ?? 0
    const delta = scored[i + 1].score - scored[i].score

    // 检查两张卡是否都缺少转折关键词
    const hasTurningWord =
      turningKeywords.some((kw) => (cardA.title + cardA.content).includes(kw)) ||
      turningKeywords.some((kw) => (cardB.title + cardB.content).includes(kw))

    // 1. 阶段跳跃：pre 直接到 post，跳过 mid
    if (stageA === 'pre' && stageB === 'post') {
      const key = `stage_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'stage_transition',
          hint: '前期直接跳到后期，缺少中期过渡（主角动机变化未交代）',
          severity: 'high',
        })
      }
    }

    // 2. 情绪翻转：从正到负或从负到正，差值大
    if (emoA > 0 && emoB < 0 && emoA - emoB > 4) {
      const key = `emotion_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'emotion_shift',
          hint: '情绪从正面急转负面，需要转折事件来铺垫（如冲突/误会/背叛）',
          severity: 'high',
        })
      }
    } else if (emoA < 0 && emoB > 0 && emoB - emoA > 4) {
      const key = `emotion_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'emotion_shift',
          hint: '情绪从负面急转正面，需要转折事件来铺垫（如和解/重逢/真相揭露）',
          severity: 'high',
        })
      }
    }

    // 3. 分数间距大且无转折关键词
    if (delta > 0.15 && !hasTurningWord) {
      const key = `gap_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'score_gap',
          hint: '这里可能需要一个转折事件（主角动机过渡缺失）',
          severity: delta > 0.25 ? 'high' : 'medium',
        })
      }
    }
  }

  return points
}

/**
 * 叙事线排序引擎（纯规则）
 * 综合权重：阶段(0/0.3/0.5/1) + 关键词±0.2 + 时间戳归一(0-1)
 */
export function sortNarrativeLine(cards: Card[]): SortLineResult {
  if (cards.length === 0) return { cards: [], gaps: [], turningPoints: [] }

  const tsMin = Math.min(...cards.map((c) => c.createdAt))
  const tsMax = Math.max(...cards.map((c) => c.createdAt))
  const tsRange = tsMax === tsMin ? 1 : tsMax - tsMin

  const scored = cards.map((c, i) => {
    const stage = stageWeight[c.stage ?? 'none'] ?? 0.3
    const kw = contentScore(c.content)
    const ts = (c.createdAt - tsMin) / tsRange
    const orderWeight = typeof c.order === 'number' ? (c.order / 10000) : 0
    const score = stage + kw * 0.3 + ts * 0.3 + orderWeight
    return { card: c, score, origIndex: i }
  })

  scored.sort((a, b) => a.score - b.score || a.card.createdAt - b.card.createdAt || a.origIndex - b.origIndex)
  const sorted = scored.map((s) => s.card)

  // 转折事件检测
  const turningPoints = detectTurningPoints(sorted, scored)

  // 缺口检测：相邻卡片 score 间距大 => sparse；score 密集+同阶段 => dense
  const gaps: SortGap[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = scored[i], b = scored[i + 1]
    const delta = b.score - a.score
    // 同阶段且 delta 极小（< 0.05）且在 3 张内连续 => dense
    const runLength = (() => {
      let n = 1
      for (let k = i + 1; k < sorted.length && scored[k].card.stage === a.card.stage; k++) n++
      return n
    })()
    if (delta > 0.15) {
      gaps.push({
        afterIndex: i,
        afterCardId: sorted[i].id,
        hint: '这里可能需要一个转折事件（主角动机过渡缺失）',
        density: 'sparse',
      })
    } else if (delta < 0.01 && runLength >= 3) {
      gaps.push({
        afterIndex: i,
        afterCardId: sorted[i].id,
        hint: '这段内容较多，考虑拆分章节',
        density: 'dense',
      })
    }
  }

  return { cards: sorted, gaps, turningPoints }
}
