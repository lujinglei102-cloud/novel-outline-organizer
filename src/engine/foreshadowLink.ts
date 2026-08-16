import type { Card, Link } from '@/types'
import { tokenize } from './tokenizer'

/**
 * 伏笔关联引擎
 * - 两两卡片：统计关键词共现
 * - 共现词列表：tokenize 后停用词过滤 + 单字过滤
 * - 共现 >= 2 个词 或 共现 1 个「高价值词」=> 标记关联
 */

const highValueTokens = new Set([
  '玉佩','信物','日记','照片','录音','信件','项链','戒指','伤疤','伤痕','秘密','真相',
  '谎言','身份','误会','背叛','合约','遗嘱','报告','监控','录音笔','记忆','梦境','约定',
  '孩子','怀孕','血缘','亲子鉴定','孩子','文件','密码','钥匙','胎记','字迹','笔记',
])

function meaningfulTokens(text: string): string[] {
  return Array.from(new Set(
    tokenize(text).filter((w) => w.length >= 2)
  ))
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export interface LinkEx extends Link {
  sharedTokens: string[]
}

export function findForeshadowLinks(cards: Card[]): LinkEx[] {
  const links: LinkEx[] = []
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i], b = cards[j]
      const tA = meaningfulTokens(a.content)
      const tB = new Set(meaningfulTokens(b.content))
      const shared: string[] = []
      for (const t of tA) if (tB.has(t)) shared.push(t)
      if (shared.length === 0) continue
      const hvShared = shared.filter((t) => highValueTokens.has(t))
      if (shared.length < 2 && hvShared.length === 0) continue

      let reason = ''
      if (hvShared.length > 0) {
        reason = `两张卡片都提到了「${hvShared[0]}」，此物可能贯穿剧情——时差可用来做伏笔回收`
      } else if (shared.length >= 2) {
        reason = `共现关键词：${shared.slice(0, 3).join('、')}。若 A 发生在前期，B 可能是 A 的结果`
      }
      links.push({
        id: genId(),
        cardAId: a.id,
        cardBId: b.id,
        reason,
        confirmed: false,
        hidden: false,
        sharedTokens: shared,
      })
    }
  }
  // 关联度高的（hvShared 更多 / shared 更多）排前
  links.sort((x, y) => {
    const aHV = x.sharedTokens.filter((t) => highValueTokens.has(t)).length
    const bHV = y.sharedTokens.filter((t) => highValueTokens.has(t)).length
    return bHV - aHV || y.sharedTokens.length - x.sharedTokens.length
  })
  return links
}
