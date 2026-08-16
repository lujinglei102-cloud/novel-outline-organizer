// 灵感卡片所属阶段
export type Stage = 'pre' | 'mid' | 'post' | 'none'

// 书籍
export interface Book {
  id: string
  title: string // 书名
  createdAt: number
  updatedAt: number
}

// 灵感卡片
export interface Card {
  id: string
  title: string // 卡片标题
  content: string // 正文 <=500 字
  createdAt: number
  updatedAt: number
  bookId?: string // 所属书籍
  characterId?: string // 关联角色
  stage?: Stage // 前期/中期/后期/未分类
  emotion?: number // -5..5
  intensity?: number // 1..5
  emotionManual?: boolean // 用户是否手动设置了情绪值（true 时 retagAll 不覆盖）
  order?: number // 叙事线顺序
  isForeshadow?: boolean // 手动标记为伏笔
  foreshadowResolved?: boolean // 伏笔是否已回收
}

// 角色
export interface Character {
  id: string
  name: string
  mentionCount: number
  representativeDesc?: string
  conflictTag?: string
}

// 伏笔关联
export interface Link {
  id: string
  cardAId: string
  cardBId: string
  reason: string // 共现关键词
  confirmed: boolean
  hidden: boolean
  resolved?: boolean // 伏笔是否已回收
}

// 关键锚点
export interface Anchor {
  name: string
  hint: string
}

// 结构模板
export interface Template {
  id: string
  name: string // 追妻火葬场...
  nodes: string[] // 结构节点名
  anchors: Anchor[] // 关键锚点
  idealEmotion: number[] // 各节点理想情绪值
}

// 章节
export interface Chapter {
  id: string
  index: number
  title: string
  conflict: string // 冲突一句话
  cardIds: string[] // 插入的卡片
  nodeId: string // 所属结构节点
}

// 叙事线间隙
export interface SortGap {
  afterIndex: number
  hint: string
  density: 'dense' | 'sparse' | null
}

// 梳理结果
export interface SortResult {
  cards: Card[] // 已排序
  characters: Character[]
  links: Link[]
  gaps: { afterCardId: string; hint: string }[]
  generatedAt: number
  cardHash: string
}
