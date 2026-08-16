// 情绪关键词词典（正负向 + 强度映射）+ 标注引擎


export const emotionDict = [
  // 正向情绪
  { word, emotion, intensity },
  { word: '甜蜜', emotion: 5, intensity: 4 },
  { word: '幸福', emotion: 5, intensity: 4 },
  { word: '开心', emotion: 4, intensity: 3 },
  { word: '高兴', emotion: 4, intensity: 3 },
  { word: '喜欢', emotion: 3, intensity: 2 },
  { word: '爱上', emotion: 4, intensity: 4 },
  { word: '心动', emotion: 4, intensity: 4 },
  { word: '告白', emotion: 4, intensity: 5 },
  { word: '接吻', emotion: 4, intensity: 5 },
  { word: '拥抱', emotion: 3, intensity: 3 },
  { word: '笑', emotion: 3, intensity: 2 },
  { word: '重逢', emotion: 4, intensity: 4 },
  { word: '和好', emotion: 4, intensity: 4 },
  { word: '圆满', emotion: 5, intensity: 5 },
  { word: '和解', emotion: 3, intensity: 3 },
  { word: '原谅', emotion: 3, intensity: 3 },
  { word: '温柔', emotion: 3, intensity: 2 },
  { word: '宠溺', emotion: 4, intensity: 4 },
  { word: '求婚', emotion: 5, intensity: 5 },
  { word: '结婚', emotion: 5, intensity: 5 },
  { word: '初见', emotion: 2, intensity: 3 },
  { word: '暧昧', emotion: 2, intensity: 3 },
  // 负向情绪
  { word, emotion: -3, intensity },
  { word: '伤心', emotion: -4, intensity: 3 },
  { word: '难过', emotion: -3, intensity: 3 },
  { word: '哭', emotion: -4, intensity: 3 },
  { word: '哭泣', emotion: -4, intensity: 4 },
  { word: '绝望', emotion: -5, intensity: 5 },
  { word: '心碎', emotion: -5, intensity: 5 },
  { word: '背叛', emotion: -4, intensity: 5 },
  { word: '分手', emotion: -4, intensity: 5 },
  { word: '离婚', emotion: -4, intensity: 5 },
  { word: '误会', emotion: -3, intensity: 4 },
  { word: '争吵', emotion: -3, intensity: 5 },
  { word: '质问', emotion: -3, intensity: 4 },
  { word: '羞辱', emotion: -4, intensity: 5 },
  { word: '跪求', emotion: -4, intensity: 5 },
  { word: '下跪', emotion: -4, intensity: 5 },
  { word: '后悔', emotion: -3, intensity: 4 },
  { word: '恨', emotion: -5, intensity: 5 },
  { word: '痛苦', emotion: -4, intensity: 4 },
  { word: '悲伤', emotion: -4, intensity: 4 },
  { word: '孤单', emotion: -2, intensity: 2 },
  { word: '放下', emotion: -2, intensity: 2 },
  { word: '离开', emotion: -2, intensity: 3 },
  { word: '失踪', emotion: -3, intensity: 4 },
  { word: '车祸', emotion: -5, intensity: 5 },
  { word: '重病', emotion: -5, intensity: 5 },
  { word: '流产', emotion: -5, intensity: 5 },
  { word: '死亡', emotion: -5, intensity: 5 },
  { word: '死了', emotion: -5, intensity: 5 },
  { word: '耳光', emotion: -3, intensity: 5 },
  { word: '受伤', emotion: -3, intensity: 4 },
  { word: '伤痕', emotion: -3, intensity: 4 },
  { word: '淋雨', emotion: -3, intensity: 4 },
  { word: '破产', emotion: -4, intensity: 5 },
  { word: '复仇', emotion: -2, intensity: 5 },
  { word: '报复', emotion: -3, intensity: 5 },
  { word: '替身', emotion: -2, intensity: 4 },
  { word: '白月光', emotion: -1, intensity: 3 },
  { word: '揭穿', emotion: -3, intensity: 5 },
  { word: '身份揭露', emotion: -3, intensity: 5 },
  { word: '堕胎', emotion: -5, intensity: 5 },
  // 中性强度高（冲突）
  { word, emotion: -4, intensity },
  { word: '劫持', emotion: -4, intensity: 5 },
  { word: '陷害', emotion: -4, intensity: 5 },
  { word: '阴谋', emotion: -3, intensity: 4 },
  { word: '真相', emotion: 0, intensity: 4 },
  { word: '秘密', emotion: 0, intensity: 4 },
  { word: '揭露', emotion: 0, intensity: 5 },
  { word: '争执', emotion: -2, intensity: 4 },
  { word: '威胁', emotion: -3, intensity: 5 },
]

const WORD_MAXLEN = 4

export function tagEmotion(text) {
  let emoSum = 0
  let intSum = 0
  let hits = 0
  const matched = []
  for (const entry of emotionDict) {
    let idx = 0
    let localCount = 0
    while ((idx = text.indexOf(entry.word, idx)) !== -1) {
      localCount++
      idx += entry.word.length
      if (localCount >= 2) break
    }
    if (localCount > 0) {
      emoSum += entry.emotion * localCount
      intSum += (entry.intensity ?? 3) * localCount
      hits += localCount
      matched.push(entry.word)
      // 加速：只扫 WORD_MAXLEN
    }
  }
  if (hits === 0) return { emotion: 0, intensity: 1, matched: [] }
  const avgEmo = Math.max(-5, Math.min(5, Math.round(emoSum / hits)))
  const avgInt = Math.max(1, Math.min(5, Math.round(intSum / hits)))
  return { emotion: avgEmo, intensity: avgInt, matched }
}

export function retagAll(cards) {
  return cards.map((c) => {
    const { emotion, intensity } = tagEmotion(c.content)
    return { ...c, emotion, intensity }
  })
}
