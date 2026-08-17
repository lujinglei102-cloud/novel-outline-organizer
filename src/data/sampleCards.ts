// 新手引导示例数据：4 张覆盖前期/中期/后期 + 不同情绪/伏笔的灵感卡片
// 用于首次访问时自动创建，帮助用户快速理解产品功能
export interface SampleCardSeed {
  title: string
  content: string
  stage: 'pre' | 'mid' | 'post' | 'none'
  emotion: number
  intensity: number
  isForeshadow: boolean
  emotionManual: boolean
}

export const SAMPLE_CARDS: SampleCardSeed[] = [
  {
    title: '初遇：雨夜的伞',
    content: '沈知行和林婉清在暴雨夜相遇，他把唯一的伞让给她，自己淋着雨走开。她记下了他的姓氏。',
    stage: 'pre',
    emotion: 2,
    intensity: 2,
    isForeshadow: false,
    emotionManual: true,
  },
  {
    title: '玉佩的承诺',
    content: '沈知行把祖传玉佩交给林婉清作为信物，约定三年后在此地重逢。这块玉佩暗藏身世秘密。',
    stage: 'pre',
    emotion: 3,
    intensity: 3,
    isForeshadow: true,
    emotionManual: true,
  },
  {
    title: '身份揭露：误会爆发',
    content: '林婉清发现沈知行接近她是为了复仇，并非真情。误会爆发，两人在咖啡店激烈争吵后分手。',
    stage: 'mid',
    emotion: -5,
    intensity: 5,
    isForeshadow: false,
    emotionManual: true,
  },
  {
    title: '玉佩回收：真相揭晓',
    content: '三年后林婉清挖出当年埋下的玉佩，发现里面藏着的字条——沈知行一直在暗中保护她。误会终于解开。',
    stage: 'post',
    emotion: 4,
    intensity: 4,
    isForeshadow: false,
    emotionManual: true,
  },
]
