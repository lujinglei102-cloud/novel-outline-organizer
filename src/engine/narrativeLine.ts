import type {
  Card,
  StageDistribution,
  RhythmDensity,
  DenseRegion,
  SparseRegion,
  EmotionArcSummary,
  NarrativeQuality,
  QualityCategory,
  StructuralAnalysis,
  TurningPointType,
  Severity,
} from '@/types'

// 阶段权重（前期 < 中期 < 后期）
const stageWeight: Record<string, number> = {
  pre: 0,
  mid: 0.5,
  post: 1,
  none: 0.3,
}

// 排序关键词：匹配到会影响叙事顺序
const earlyKeywords = [
  '开始', '初见', '初遇', '小时候', '从前', '出生', '相遇', '初识', '第一次', '回忆', '前世', '重生前',
]
const lateKeywords = [
  '结局', '最后', '终章', '多年后', '结局', '尾声', '落幕', '老去', '死去', '临死', '终于', '最后',
]

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
  scored: { card: Card; score: number; origIndex: number }[]
}

export interface TurningPoint {
  afterCardId: string
  type: TurningPointType
  hint: string
  severity: Severity
}

// 3.2 窄化：仅保留真正的转折连词（情节词移走，避免豁免过度）
const turningKeywords = [
  '但是', '然而', '突然', '可是', '不料', '没想到', '意外', '转折',
  '回头', '反悔', '醒悟', '顿悟', '幡然',
]

/**
 * 检测转折/过渡问题：
 * 1. 阶段跳跃（pre→post / pre→none / none→post）
 * 2. 情绪翻转（正负反转 & 差值>4）
 * 3. 情绪趋势（连续3张同向累积变化>6）
 * 4. 分数间距（delta>0.25 且无转折词，3.3 提高阈值）
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

    const hasTurningWord =
      turningKeywords.some((kw) => (cardA.title + cardA.content).includes(kw)) ||
      turningKeywords.some((kw) => (cardB.title + cardB.content).includes(kw))

    // --- 1. 阶段跳跃（3.4 补齐） ---
    // pre → post
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
    // pre → none（新增）
    if (stageA === 'pre' && stageB === 'none') {
      const key = `stage_pre_none_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'stage_transition',
          hint: '前期卡片后阶段信息缺失，建议补充中期过渡',
          severity: 'medium',
        })
      }
    }
    // none → post（新增）
    if (stageA === 'none' && stageB === 'post') {
      const key = `stage_none_post_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'stage_transition',
          hint: '未分类卡片直接跳到后期，缺少中期铺垫',
          severity: 'medium',
        })
      }
    }

    // --- 2. 情绪翻转（相邻正负反转 & |差值|>4） ---
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

    // --- 2b. 情绪趋势检测（3.5 新增：3张滑动窗口） ---
    if (i >= 2) {
      const emoPrev2 = sorted[i - 2].emotion ?? 0
      const cumulativeChange = emoB - emoPrev2
      if (
        Math.abs(cumulativeChange) > 6 &&
        emoPrev2 !== 0 &&
        emoB !== 0 &&
        Math.sign(emoPrev2) === Math.sign(emoB)
      ) {
        const key = `emotion_trend_${i}`
        if (!seen.has(key)) {
          seen.add(key)
          points.push({
            afterCardId: cardA.id,
            type: 'emotion_shift',
            hint:
              cumulativeChange > 0
                ? '情绪持续上升，注意是否缺少低谷调节'
                : '情绪持续下降，注意是否缺少缓冲转折',
            severity: 'medium',
          })
        }
      }
    }

    // --- 3. 分数间距（3.3 提高阈值：delta > 0.25） ---
    if (delta > 0.25 && !hasTurningWord) {
      const key = `gap_${i}`
      if (!seen.has(key)) {
        seen.add(key)
        points.push({
          afterCardId: cardA.id,
          type: 'score_gap',
          hint: '这里可能需要一个转折事件（主角动机过渡缺失）',
          severity: delta > 0.4 ? 'high' : 'medium',
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
  if (cards.length === 0) return { cards: [], gaps: [], turningPoints: [], scored: [] }

  const tsMin = Math.min(...cards.map((c) => c.createdAt))
  const tsMax = Math.max(...cards.map((c) => c.createdAt))
  const tsRange = tsMax === tsMin ? 1 : tsMax - tsMin

  const scored = cards.map((c, i) => {
    const stage = stageWeight[c.stage ?? 'none'] ?? 0.3
    const kw = contentScore(c.content)
    const ts = (c.createdAt - tsMin) / tsRange
    const orderWeight = typeof c.order === 'number' ? c.order / 10000 : 0
    const score = stage + kw * 0.3 + ts * 0.3 + orderWeight
    return { card: c, score, origIndex: i }
  })

  scored.sort((a, b) => a.score - b.score || a.card.createdAt - b.card.createdAt || a.origIndex - b.origIndex)
  const sorted = scored.map((s) => s.card)

  const turningPoints = detectTurningPoints(sorted, scored)

  // 3.1 删除 gaps 中的 sparse 分支（与 turningPoints 的 score_gap 重复），仅保留 dense
  const gaps: SortGap[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = scored[i], b = scored[i + 1]
    const delta = b.score - a.score
    const runLength = (() => {
      let n = 1
      for (let k = i + 1; k < sorted.length && scored[k].card.stage === a.card.stage; k++) n++
      return n
    })()
    if (delta < 0.01 && runLength >= 3) {
      gaps.push({
        afterIndex: i,
        afterCardId: sorted[i].id,
        hint: '这段内容较多，考虑拆分章节',
        density: 'dense',
      })
    }
  }

  return { cards: sorted, gaps, turningPoints, scored }
}

// =========================
// 3.6 新增：结构分析导出函数
// =========================

export function analyzeStageDistribution(cards: Card[]): StageDistribution {
  const count: Record<string, number> = { pre: 0, mid: 0, post: 0, none: 0 }
  for (const c of cards) count[c.stage ?? 'none']++
  const total = cards.length || 1
  const prePct = count.pre / total
  const postPct = count.post / total
  const nonePct = count.none / total

  let suggestion: string | undefined
  if (cards.length === 0) {
    suggestion = '暂无卡片，先录入灵感卡吧'
  } else if (nonePct > 0.5) {
    suggestion = '超过半数卡片未分类，建议为每张卡片标注前期/中期/后期'
  } else if (count.mid === 0 && count.pre > 0 && count.post > 0) {
    suggestion = '完全缺失中期内容，叙事会跳脱，建议补充中期发展'
  } else if (prePct > 0.6) {
    suggestion = '前期占比过高（>60%），建议补充中后期展开'
  } else if (postPct > 0.5) {
    suggestion = '后期占比过高（>50%），建议检查前期铺垫是否充足'
  } else if (count.pre === 0 || count.post === 0) {
    suggestion = '阶段不完整，建议确保前期、中期、后期三个阶段都有卡片'
  }

  return {
    pre: count.pre,
    mid: count.mid,
    post: count.post,
    none: count.none,
    total: cards.length,
    suggestion,
  }
}

export function analyzeEmotionArc(cards: Card[]): EmotionArcSummary {
  if (cards.length === 0) {
    return { hasReversal: false, maxEmotion: 0, minEmotion: 0, avgEmotion: 0, flatWarning: '暂无情绪数据' }
  }
  const emos = cards.map((c) => c.emotion ?? 0)
  const maxEmotion = Math.max(...emos)
  const minEmotion = Math.min(...emos)
  const avgEmotion = emos.reduce((a, b) => a + b, 0) / emos.length

  let hasReversal = false
  for (let i = 1; i < emos.length; i++) {
    const a = emos[i - 1], b = emos[i]
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) { hasReversal = true; break }
  }
  // 另一种：差值≥4也视为有"大转折"
  if (!hasReversal && maxEmotion - minEmotion >= 4) {
    let signFlip = false
    for (const e of emos) { if (e > 0) { if (signFlip === undefined) {} } }
    // 只要 max min 极性不同就算
    if ((maxEmotion > 0 && minEmotion < 0)) hasReversal = true
  }

  let flatWarning: string | undefined
  if (maxEmotion - minEmotion < 3) flatWarning = '情绪值全程平缓，缺乏戏剧张力，建议加大正负情绪落差'
  if (maxEmotion - minEmotion < 1) flatWarning = '情绪几乎无波动，强烈建议为关键卡片设置情绪值'

  return { hasReversal, maxEmotion, minEmotion, avgEmotion, flatWarning }
}

export function analyzeRhythmDensity(sorted: Card[], scored: { card: Card; score: number; origIndex: number }[]): RhythmDensity {
  const denseRegions: DenseRegion[] = []
  const sparseRegions: SparseRegion[] = []
  let runStart = 0
  for (let i = 0; i < sorted.length; i++) {
    const isLast = i === sorted.length - 1
    const sameStage = !isLast && sorted[i].stage === sorted[i + 1].stage
    const nearScore = !isLast && Math.abs(scored[i + 1].score - scored[i].score) < 0.02
    const shouldEnd = isLast || !(sameStage && nearScore)
    if (shouldEnd) {
      const endIdx = i
      const count = endIdx - runStart + 1
      if (count >= 3) {
        denseRegions.push({
          startIndex: runStart,
          endIndex: endIdx,
          cardCount: count,
          hint: `第${runStart + 1}-${endIdx + 1}张卡节奏过密（${count}张${sorted[runStart].stage === 'pre' ? '前期' : sorted[runStart].stage === 'mid' ? '中期' : sorted[runStart].stage === 'post' ? '后期' : '同阶段'}连续），建议拆分章节`,
        })
      }
      runStart = i + 1
    }
  }
  // sparse 区域：来自之前 turningPoints 的 score_gap，这里保持 SparseRegion 空（3.1 去掉重复）
  // 但如果相邻阶段变化大也列出来
  for (let i = 0; i < sorted.length - 1; i++) {
    const delta = scored[i + 1].score - scored[i].score
    if (delta > 0.4) {
      sparseRegions.push({
        afterIndex: i,
        afterCardId: sorted[i].id,
        hint: '分数跨度过大，叙事推进太急，建议加过渡',
      })
    }
  }
  return { denseRegions, sparseRegions }
}

export function evaluateTransitionQuality(cards: Card[], turningPoints: TurningPoint[], gaps: SortGap[]): NarrativeQuality {
  const categories: QualityCategory[] = []
  // --- 结构完整性（25分） ---
  const stages = new Set(cards.map((c) => c.stage ?? 'none'))
  const hasPre = stages.has('pre'), hasMid = stages.has('mid'), hasPost = stages.has('post')
  const allNone = cards.length > 0 && stages.size === 1 && stages.has('none')
  let stageScore = 0
  let stageComment = ''
  if (allNone || cards.length === 0) {
    stageScore = 0; stageComment = '全部卡片未分类，请标注前期/中期/后期'
  } else if (hasPre && hasMid && hasPost) {
    stageScore = 25; stageComment = '前期/中期/后期三阶段齐备'
  } else {
    const missing = (['pre', 'mid', 'post'] as const).filter((s) => !stages.has(s)).length
    stageScore = missing === 1 ? 15 : 5
    stageComment = `缺失${missing}个阶段，建议补齐`
  }
  categories.push({ name: '结构完整性', score: stageScore, comment: stageComment })

  // --- 情绪弧线（25分） ---
  const emo = analyzeEmotionArc(cards)
  let emoScore: number, emoComment: string
  if (emo.hasReversal && emo.maxEmotion - emo.minEmotion >= 4) {
    emoScore = 25; emoComment = '有情绪反转，张力充足'
  } else if (emo.maxEmotion - emo.minEmotion >= 3) {
    emoScore = 18; emoComment = '有情绪起伏，但缺少大反转'
  } else if (emo.maxEmotion - emo.minEmotion >= 1) {
    emoScore = 10; emoComment = '情绪起伏不足，戏剧张力偏弱'
  } else {
    emoScore = 5; emoComment = '情绪几乎无波动，建议为关键卡片设置情绪值'
  }
  categories.push({ name: '情绪弧线', score: emoScore, comment: emoComment })

  // --- 转折密度（25分） ---
  const transitions = Math.max(cards.length - 1, 1)
  const density = turningPoints.length / transitions
  let turnScore: number, turnComment: string
  if (density >= 0.1 && density <= 0.3) {
    turnScore = 25; turnComment = `转折占比${(density * 100).toFixed(0)}%，节奏适宜`
  } else if ((density >= 0.05 && density < 0.1) || (density > 0.3 && density <= 0.5)) {
    turnScore = 18; turnComment = `转折占比${(density * 100).toFixed(0)}%，略偏${density < 0.1 ? '少' : '多'}`
  } else {
    turnScore = 10; turnComment = `转折占比${(density * 100).toFixed(0)}%，${density < 0.05 ? '过于平淡' : '转折过多'}`
  }
  categories.push({ name: '转折密度', score: turnScore, comment: turnComment })

  // --- 节奏控制（25分） ---
  const denseCount = gaps.filter((g) => g.density === 'dense').length
  let rhythmScore: number, rhythmComment: string
  if (denseCount === 0) {
    rhythmScore = 25; rhythmComment = '无过度密集段落，节奏均衡'
  } else if (denseCount === 1) {
    rhythmScore = 18; rhythmComment = '有1处密集段落，建议适当拆分'
  } else {
    rhythmScore = 10; rhythmComment = `有${denseCount}处密集段落，章节分布需调整`
  }
  categories.push({ name: '节奏控制', score: rhythmScore, comment: rhythmComment })

  const overallScore = Math.round(categories.reduce((s, c) => s + c.score, 0))
  return { overallScore, categories }
}

/**
 * 一键生成 Layer 1 结构分析（对外入口）
 */
export function buildStructuralAnalysis(
  sorted: Card[],
  turningPoints: TurningPoint[],
  scored: { card: Card; score: number; origIndex: number }[],
  gaps: SortGap[],
): StructuralAnalysis {
  const stageDistribution = analyzeStageDistribution(sorted)
  const rhythmDensity = analyzeRhythmDensity(sorted, scored)
  const turningPointTimeline = turningPoints.map((t) => ({ ...t }))
  const emotionArc = analyzeEmotionArc(sorted)
  const quality = evaluateTransitionQuality(sorted, turningPoints, gaps)
  return { stageDistribution, rhythmDensity, turningPointTimeline, emotionArc, quality }
}
