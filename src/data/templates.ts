import type { Template } from '@/types'

export const TEMPLATES: Template[] = [
  {
    id: 'zhuiqi',
    name: '追妻火葬场',
    nodes: ['开端甜宠', '误会破裂', '男主追妻', '和解圆满'],
    anchors: [
      { name: '关系破裂点', hint: '女主心死离开的瞬间（分手/签字/消失）' },
      { name: '男主后悔点', hint: '男主得知真相/发现女主真的不回头' },
      { name: '和解点', hint: '女主真正原谅，而非被道德绑架' },
    ],
    idealEmotion: [4, -4, -2, 4],
  },
  {
    id: 'pojing',
    name: '破镜重圆',
    nodes: ['过去相爱', '分开伤痛', '重逢拉扯', '重归于好'],
    anchors: [
      { name: '当年分开点', hint: '分手/出国/消失的原因，要够具体' },
      { name: '重逢点', hint: '多年后再见的场景，要带张力' },
      { name: '真相揭开点', hint: '当年误会/苦衷摊牌时刻' },
    ],
    idealEmotion: [3, -4, -1, 4],
  },
  {
    id: 'tishen',
    name: '替身白月光',
    nodes: ['替身开始', '相处动心', '替身揭穿', '替身转正'],
    anchors: [
      { name: '白月光回归点', hint: '白月光出现，男主开始摇摆' },
      { name: '替身身份揭穿点', hint: '女主知道自己是替身，心碎离开' },
      { name: '认清真心点', hint: '男主终于明白自己爱的是女主本人' },
    ],
    idealEmotion: [1, 3, -5, 4],
  },
  {
    id: 'xianhun',
    name: '先婚后爱',
    nodes: ['协议结婚', '共处生情', '外部考验', '真心在一起'],
    anchors: [
      { name: '领证/搬入点', hint: '契约生效，两人开始同一屋檐下' },
      { name: '第一次心动点', hint: '女主看到男主反差温柔/救命瞬间' },
      { name: '协议到期点', hint: '是否续约/摊牌真心的关卡' },
    ],
    idealEmotion: [1, 2, -2, 4],
  },
  {
    id: 'chongsheng',
    name: '重生复仇',
    nodes: ['重生归来', '积蓄力量', '反击仇人', '尘埃落定'],
    anchors: [
      { name: '重生触发点', hint: '上一世死亡瞬间，睁眼看时钟/日历' },
      { name: '第一次小反击', hint: '小胜一仗，建立自信' },
      { name: '决战点', hint: '最大仇人的倒台时刻，要够爽' },
    ],
    idealEmotion: [-3, 0, 2, 3],
  },
]

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function listTemplates(): Template[] {
  return TEMPLATES
}

export function defaultTemplateId(): string {
  return TEMPLATES[0].id
}
