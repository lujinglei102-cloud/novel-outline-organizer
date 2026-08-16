import type { Card, Chapter, Character, Link, Template } from '@/types'

export interface OutlineDocParts {
  bookTitle: string
  template: Template
  chapters: Chapter[]
  cardsById: Map<string, Card>
  characters: Character[]
  links: Link[]
  cardsSorted: Card[]
}

function linesOfChapter(c: Chapter, cardsById: Map<string, Card>): string[] {
  const out: string[] = []
  out.push(`## ${c.title}`)
  out.push('')
  out.push(`> 所属结构：${c.nodeId}`)
  out.push('')
  out.push(`**冲突：** ${c.conflict}`)
  out.push('')
  if (c.cardIds.length > 0) {
    out.push(`**灵感卡片：** (${c.cardIds.length} 张)`)
    out.push('')
    for (const id of c.cardIds) {
      const card = cardsById.get(id)
      if (card) {
        out.push(`- 📝 卡片 #${card.id.slice(-6)}`)
        for (const line of card.content.split('\n')) out.push(`\t${line}`)
      }
    }
    out.push('')
  }
  return out
}

export function exportMarkdown(p: OutlineDocParts): string {
  const lines: string[] = []
  lines.push(`# ${p.bookTitle || '（未填书名）'}`)
  lines.push('')
  lines.push(`> 结构模板：**${p.template.name}**`)
  lines.push(`>`)
  lines.push(`> 结构节点：${p.template.nodes.join(' → ')}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## 章节大纲')
  lines.push('')
  for (const ch of p.chapters) lines.push(...linesOfChapter(ch, p.cardsById))
  lines.push('---')
  lines.push('')
  lines.push('## 角色弧光概览')
  lines.push('')
  for (const c of p.characters) {
    lines.push(`- **${c.name}**（出现 ${c.mentionCount} 次）`)
    if (c.representativeDesc) lines.push(`\t- 代表性描述：${c.representativeDesc}`)
    if (c.conflictTag) lines.push(`\t- 潜在线索：${c.conflictTag}`)
  }
  lines.push('')
  lines.push('## 伏笔追踪清单')
  lines.push('')
  const visibleLinks = p.links.filter((l) => !l.hidden)
  if (visibleLinks.length === 0) {
    lines.push('_（暂无已标记伏笔）_')
  } else {
    lines.push('| 状态 | 卡片A | 卡片B | 标注 |')
    lines.push('|---|---|---|---|')
    for (const l of visibleLinks) {
      const a = p.cardsById.get(l.cardAId)?.content.slice(0, 12) ?? '?'
      const b = p.cardsById.get(l.cardBId)?.content.slice(0, 12) ?? '?'
      lines.push(`| ${l.confirmed ? '✅已埋' : '⚠待确认'} | ${a}… | ${b}… | ${l.reason} |`)
    }
  }
  lines.push('')
  lines.push('## 情绪曲线说明')
  lines.push('')
  if (p.cardsSorted.length > 0) {
    const withEmo = p.cardsSorted.filter((c) => typeof c.emotion === 'number')
    if (withEmo.length > 0) {
      const avg = withEmo.reduce((s, c) => s + (c.emotion ?? 0), 0) / withEmo.length
      const minCard = withEmo.reduce((a, b) => (a.emotion! < b.emotion! ? a : b))
      const maxCard = withEmo.reduce((a, b) => (a.emotion! > b.emotion! ? a : b))
      lines.push(`- 全书平均情绪值：**${avg.toFixed(2)}**（-5..+5）`)
      lines.push(`- 全书情绪谷底：第 **${p.cardsSorted.indexOf(minCard) + 1}** 张卡（位于「${minCard.content.slice(0, 15)}…」）`)
      lines.push(`- 全书情绪巅峰：第 **${p.cardsSorted.indexOf(maxCard) + 1}** 张卡（位于「${maxCard.content.slice(0, 15)}…」）`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

export function exportPlainText(p: OutlineDocParts): string {
  return exportMarkdown(p) // 第一版 txt 直接用 md 去掉图片语法，此处 md 本身几乎可作为纯文本阅读
}
