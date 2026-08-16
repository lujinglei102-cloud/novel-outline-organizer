import type { Card, Character } from '@/types'
import { tokenize, isNameCandidate } from './tokenizer'

function timeIndex(c: Card, all: Card[]): number {
  return [...all].sort((a, b) => a.createdAt - b.createdAt).findIndex((x) => x.id === c.id)
}

export interface CharacterResult {
  characters: Character[]
  cardCharacterMap: Map<string, string> // cardId -> 主要角色名
}

/**
 * 角色提取引擎
 * - 对每张卡片分词，识别人名候选词并统计频率
 * - 代表性描述：该角色出现最多/最早的卡片原文（前 20 字）
 * - 冲突标签：若某角色在卡片里同时出现正负情绪词，标矛盾提示
 */
export function extractCharacters(cards: Card[]): CharacterResult {
  const mention = new Map<string, { count: number; cards: Card[] }>()
  const cardPrimary = new Map<string, string>()

  for (const card of cards) {
    const toks = tokenize(card.content)
    const names = new Set<string>()
    for (const t of toks) if (isNameCandidate(t)) names.add(t)
    // 也扫描 card.characterId 对应的角色名
    if (card.characterId) {
      // characterId 这里暂存 name（store 层可替换为真正 id）
      names.add(card.characterId)
    }
    for (const name of names) {
      if (!mention.has(name)) mention.set(name, { count: 0, cards: [] })
      const entry = mention.get(name)!
      entry.count += 1
      entry.cards.push(card)
    }
    if (names.size > 0) {
      // 取出现频率最高的第一个作为该卡片的「主要角色」
      let best = ''
      let bestCount = 0
      for (const n of names) {
        const c = mention.get(n)!.count
        if (c > bestCount) { bestCount = c; best = n }
      }
      cardPrimary.set(card.id, best)
    }
  }

  const posWords = ['喜欢','爱','幸福','甜','笑','开心','拥抱','告白']
  const negWords = ['恨','分手','痛苦','哭','绝望','放下','离开','背叛']

  const chars: Character[] = [...mention.entries()].map(([name, v]) => {
    const sorted = [...v.cards].sort((a, b) => timeIndex(a, cards) - timeIndex(b, cards))
    const first = sorted[0]
    const representativeDesc = first ? first.content.slice(0, 30) + (first.content.length > 30 ? '…' : '') : ''
    let pos = 0, neg = 0
    for (const c of v.cards) {
      for (const w of posWords) if (c.content.includes(w)) pos++
      for (const w of negWords) if (c.content.includes(w)) neg++
    }
    let conflictTag: string | undefined
    if (neg > 0 && pos > 0) {
      conflictTag = '嘴上说要放下，卡片里反复写他（情感矛盾）'
    } else if (pos === 0 && neg > 2) {
      conflictTag = '多为负面情绪，注意角色弧光转变'
    } else if (pos > 2 && neg === 0) {
      conflictTag = '全是正面描写，可能缺少成长冲突'
    }
    return {
      id: 'char-' + name,
      name,
      mentionCount: v.count,
      representativeDesc,
      conflictTag,
    }
  }).sort((a, b) => b.mentionCount - a.mentionCount)

  return { characters: chars, cardCharacterMap: cardPrimary }
}
