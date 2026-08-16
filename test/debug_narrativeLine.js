 break }
  for (const kw of lateKeywords) if (content.includes(kw)) { score += 0.2; break }
  return score
}



/**
 * 叙事线排序引擎（纯规则）
 * 综合权重：阶段(0/0.3/0.5/1) + 关键词±0.2 + 时间戳归一(0-1)
 */
export function sortNarrativeLine(cards[]) {
  if (cards.length === 0) return { cards: [], gaps: [] }

  const tsMin = Math.min(...cards.map((c) => c.createdAt))
  const tsMax = Math.max(...cards.map((c) => c.createdAt))
  const tsRange = tsMax === tsMin ? 1 : tsMax - tsMin

  const scored = cards.map((c, i) => {
    const stage = stageWeight[c.stage ?? 'none'] ?? 0.3
    const kw = contentScore(c.content)
    const ts = (c.createdAt - tsMin) / tsRange
    const score = stage + kw * 0.3 + ts * 0.3 + c.order ? (c.order / 10000) : 0
    return { card: c, score, origIndex: i }
  })

  scored.sort((a, b) => a.score - b.score || a.card.createdAt - b.card.createdAt || a.origIndex - b.origIndex)
  const sorted = scored.map((s) => s.card)

  // 缺口检测：相邻卡片 score 间距大 => sparse；score 密集+同阶段 => dense
  const gaps[] = []
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

  return { cards: sorted, gaps }
}
