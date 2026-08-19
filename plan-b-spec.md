# 方案 B 修改方案：结构分析 + 叙事建议双层架构

---

## 一、改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/engine/narrativeLine.ts` | 重构 | 核心引擎：拆分检测逻辑，新增分析层 |
| `src/routes/SortPage.tsx` | 重构 | UI：拆分为两个独立面板 |
| `src/types.ts` 或 `src/types/index.ts` | 新增类型 | 新增分析结果类型定义 |

---

## 二、类型定义（`src/types.ts` 新增）

```typescript
// 结构分析结果（Layer 1：描述性，始终展示）
export interface StructuralAnalysis {
  stageDistribution: StageDistribution
  rhythmDensity: RhythmDensity
  turningPointTimeline: TurningPointTimelineItem[]
  emotionArc: EmotionArcSummary
}

export interface StageDistribution {
  pre: number      // 前期卡片数量
  mid: number      // 中期卡片数量
  post: number     // 后期卡片数量
  none: number     // 未分类卡片数量
  total: number
  suggestion?: string  // 如"前期占比过高，建议补充中后期内容"
}

export interface RhythmDensity {
  denseRegions: DenseRegion[]   // 密集区域
  sparseRegions: SparseRegion[] // 稀疏区域
}

export interface DenseRegion {
  startIndex: number
  endIndex: number
  cardCount: number
  hint: string
}

export interface SparseRegion {
  afterIndex: number
  afterCardId: string
  hint: string
}

export interface TurningPointTimelineItem {
  afterCardId: string
  type: 'stage_transition' | 'emotion_shift' | 'score_gap'
  hint: string
  severity: 'high' | 'medium' | 'low'
}

export interface EmotionArcSummary {
  hasReversal: boolean       // 是否存在情绪反转
  maxEmotion: number
  minEmotion: number
  avgEmotion: number
  flatWarning?: string       // 如"情绪值全程平缓，缺乏戏剧张力"
}

// 叙事建议（Layer 2：可折叠，按需展开）
export interface NarrativeSuggestion {
  id: string
  afterCardId: string
  type: 'stage_transition' | 'emotion_shift' | 'score_gap'
  hint: string
  severity: 'high' | 'medium' | 'low'
  dismissed: boolean  // 用户是否已忽略
}

export interface NarrativeQuality {
  overallScore: number           // 0-100
  categories: QualityCategory[]
}

export interface QualityCategory {
  name: string        // 如"结构完整性"
  score: number       // 0-100
  comment: string     // 如"阶段分布合理"
}
```

---

## 三、引擎改动（`src/engine/narrativeLine.ts`）

### 3.1 删除 gaps 中的 sparse 检测

**原因**：与 turningPoints 的 score_gap 完全重复。

**改法**：在 `sortNarrativeLine` 函数中，删除 sparse 分支，只保留 dense 检测。

```typescript
// 改前（约第 150 行）
if (delta > 0.15) {
  gaps.push({ ... hint: '这里可能需要一个转折事件...', density: 'sparse' })
} else if (delta < 0.01 && runLength >= 3) {
  gaps.push({ ... hint: '这段内容较多，考虑拆分章节', density: 'dense' })
}

// 改后
if (delta < 0.01 && runLength >= 3) {
  gaps.push({ ... hint: '这段内容较多，考虑拆分章节', density: 'dense' })
}
```

### 3.2 窄化转折关键词白名单

**原因**：当前白名单包含大量高频词（"决定""改变""离开""发现"），导致 score_gap 几乎从不触发。

**改法**：将 `turningKeywords` 缩减为只保留真正的转折信号词。

```typescript
// 改前
const turningKeywords = [
  '但是', '然而', '突然', '可是', '不料', '没想到', '意外', '转折',
  '决定', '改变', '离开', '背叛', '真相', '发现', '揭露', '崩溃',
  '重逢', '和解', '决裂', '死亡', '复活', '失忆', '恢复记忆',
]

// 改后：只保留转折连词，情节词移到别处用
const turningKeywords = [
  '但是', '然而', '突然', '可是', '不料', '没想到', '意外', '转折',
  '回头', '反悔', '醒悟', '顿悟', '幡然'
]
```

### 3.3 提高 score_gap 阈值

**原因**：`delta > 0.15` 太敏感，接近 1/10 的 score 范围。

**改法**：提高阈值并分层。

```typescript
// 改前
if (delta > 0.15 && !hasTurningWord) {
  severity: delta > 0.25 ? 'high' : 'medium'
}

// 改后
if (delta > 0.25 && !hasTurningWord) {
  severity: delta > 0.4 ? 'high' : 'medium'
}
```

### 3.4 补齐阶段跳跃检测

**原因**：当前只检测 `pre → post`。

**改法**：在 `detectTurningPoints` 中增加两种跳跃检测。

```typescript
// 新增：pre → none（前期直接跳到未分类，阶段信息缺失）
if (stageA === 'pre' && stageB === 'none') {
  points.push({
    afterCardId: cardA.id,
    type: 'stage_transition',
    hint: '前期卡片后阶段信息缺失，建议补充中期过渡',
    severity: 'medium',
  })
}

// 新增：none → post（未分类直接跳到后期，同样缺失中期）
if (stageA === 'none' && stageB === 'post') {
  points.push({
    afterCardId: cardA.id,
    type: 'stage_transition',
    hint: '未分类卡片直接跳到后期，缺少中期铺垫',
    severity: 'medium',
  })
}
```

### 3.5 新增情绪趋势检测

**原因**：当前只检测相邻反转，不检测累积趋势。

**改法**：在 `detectTurningPoints` 中增加滑动窗口检测。

```typescript
// 新增：连续 3 张卡片情绪累积变化检测
if (i >= 2) {
  const emoPrev2 = sorted[i - 2].emotion ?? 0
  const cumulativeChange = emoB - emoPrev2
  if (Math.abs(cumulativeChange) > 6 && Math.sign(emoPrev2) === Math.sign(emoB)) {
    // 同向累积变化超过 6，说明有持续的情绪变化趋势
    points.push({
      afterCardId: cardA.id,
      type: 'emotion_shift',
      hint: cumulativeChange > 0 
        ? '情绪持续上升，注意是否缺少低谷调节'
        : '情绪持续下降，注意是否缺少缓冲转折',
      severity: 'medium',
    })
  }
}
```

### 3.6 新增结构分析函数（Layer 1 数据源）

在 `narrativeLine.ts` 中新增以下导出函数：

```typescript
// 阶段分布分析
export function analyzeStageDistribution(cards: Card[]): StageDistribution {
  // 统计 pre/mid/post/none 各阶段卡片数量
  // 计算占比
  // 给出建议（如 pre 占比 > 60% 则提示"前期占比过高"）
}

// 情绪弧线摘要
export function analyzeEmotionArc(cards: Card[]): EmotionArcSummary {
  // 计算 max/min/avg
  // 检测是否有反转
  // 如果 max - min < 3 则给出 flatWarning
}

// 过渡质量评分
export function evaluateTransitionQuality(
  cards: Card[], 
  turningPoints: TurningPoint[]
): NarrativeQuality {
  // 综合评分：阶段分布 + 情绪弧线 + 转折密度 + 节奏控制
  // 返回 0-100 总分和各项分
}
```

### 3.7 具体评分算法

过渡质量评分（0-100）由 4 项组成，各占 25 分：

**结构完整性（25 分）**
- pre/mid/post 三个阶段都有卡片：+25
- 缺 1 个阶段：+15
- 缺 2 个阶段：+5
- 全部未分类：+0

**情绪弧线（25 分）**
- 有反转（max - min ≥ 4 且符号变化）：+25
- 有起伏但无反转（max - min ≥ 3）：+18
- 起伏不足（max - min ≥ 1）：+10
- 全平（max - min < 1）：+5

**转折密度（25 分）**
- 转折事件数 / (卡片数 - 1) 在 10%-30%：+25
- 在 5%-10% 或 30%-50%：+18
- < 5% 或 > 50%：+10

**节奏控制（25 分）**
- 无 dense 警告：+25
- 有 1 个 dense 警告：+18
- 有 2+ 个 dense 警告：+10

---

## 四、UI 改动（`src/routes/SortPage.tsx`）

### 4.1 页面结构

当前 SortPage 是一个平铺的标签页结构。改为双层结构：

```
┌─────────────────────────────────────────┐
│  Layer 1：结构分析（始终展开）            │
│  ┌─────────────────────────────────────┐ │
│  │ 过渡质量评分：78 分                  │ │
│  │ [结构80] [情绪90] [转折65] [节奏75] │ │
│  └─────────────────────────────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ 阶段分布  │ │ 情绪曲线  │ │ 节奏密度  │ │
│  │ pre: 4   │ │ (图表)   │ │ (热力图)  │ │
│  │ mid: 2   │ │          │ │           │ │
│  │ post: 3  │ │          │ │           │ │
│  └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────┤
│  Layer 2：叙事建议（可折叠）    [展开/收起]│
│  ┌─────────────────────────────────────┐ │
│  │ 🔴 高优先级（2 条）                  │ │
│  │  • 前期直接跳到后期，缺少中期过渡...  │ │
│  │    [忽略]                            │ │
│  │  • 情绪从正面急转负面...             │ │
│  │    [忽略]                            │ │
│  │ 🟡 中优先级（1 条）                  │ │
│  │  • 这里可能需要一个转折事件...        │ │
│  │    [忽略]                            │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 4.2 具体改动步骤

**步骤 1：拆分为两个组件**

在 `SortPage.tsx` 中新增两个子组件：
- `StructuralAnalysisPanel`：Layer 1，接收 `StructuralAnalysis` 数据
- `NarrativeSuggestionsPanel`：Layer 2，接收 `NarrativeSuggestion[]` 数据

**步骤 2：StructuralAnalysisPanel 实现**

```tsx
function StructuralAnalysisPanel({ analysis }: { analysis: StructuralAnalysis }) {
  return (
    <div className="structural-analysis">
      {/* 过渡质量评分 */}
      <QualityScoreBar score={analysis.qualityScore} />
      
      {/* 三列并排 */}
      <div className="analysis-grid">
        <StageDistributionChart data={analysis.stageDistribution} />
        <EmotionCurve cards={cards} />  {/* 现有组件，保留 */}
        <RhythmDensityView data={analysis.rhythmDensity} />
      </div>
    </div>
  )
}
```

**步骤 3：NarrativeSuggestionsPanel 实现**

```tsx
function NarrativeSuggestionsPanel({ suggestions, onDismiss }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  
  const active = suggestions.filter(s => !s.dismissed)
  const high = active.filter(s => s.severity === 'high')
  const medium = active.filter(s => s.severity === 'medium')
  const low = active.filter(s => s.severity === 'low')
  
  return (
    <div className="narrative-suggestions">
      <button onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? '展开' : '收起'}叙事建议（{active.length} 条）
      </button>
      {!collapsed && (
        <>
          <SuggestionGroup title="高优先级" items={high} onDismiss={onDismiss} />
          <SuggestionGroup title="中优先级" items={medium} onDismiss={onDismiss} />
          <SuggestionGroup title="低优先级" items={low} onDismiss={onDismiss} />
        </>
      )}
    </div>
  )
}
```

**步骤 4：忽略功能**

在父组件 SortPage 中维护 `dismissedIds: Set<string>` 状态：

```typescript
const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

function handleDismiss(suggestionId: string) {
  setDismissedIds(prev => new Set([...prev, suggestionId]))
}
```

每次点击"重新排序"时清空 dismissedIds。

---

## 五、执行顺序

| 步骤 | 文件 | 内容 |
|------|------|------|
| 1 | `src/types.ts` | 新增所有类型定义 |
| 2 | `src/engine/narrativeLine.ts` | 所有引擎改动（3.1 ~ 3.7） |
| 3 | `src/routes/SortPage.tsx` | UI 重构为双层架构 |
| 4 | 运行现有测试 | `npx vitest run` 确保不回归 |

---

## 六、关键约束

- 不引入新 npm 包
- 保持现有数据模型兼容（SortLineResult 的 cards 和 gaps 字段不变，新增字段用可选属性）
- 现有情绪曲线组件（EmotionCurve.tsx）保持不动，仅调整调用方式
- 所有新增分析逻辑集中在 `narrativeLine.ts` 中，不分散到其他文件