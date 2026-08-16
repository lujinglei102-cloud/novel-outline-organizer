import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSortStore } from '@/stores/sortStore'
import type { Chapter, Character, Card } from '@/types'

export function ExportPage() {
  const navigate = useNavigate()
  const { loadPersisted, chapters, characters, sortedCards, getNodes, getActiveTemplate } =
    useSortStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      await loadPersisted()
      setLoading(false)
    })()
  }, [loadPersisted])

  const nodes = getNodes()
  const tpl = getActiveTemplate()
  const md = buildMarkdown({
    chapters,
    characters,
    cards: sortedCards as Card[],
    nodes,
    templateName: tpl?.name ?? '自定义',
  })
  const txt = buildPlainText(md)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">导出大纲</h1>
          <p className="text-xs text-ink-500">一键导出为 Markdown 或纯文本，可直接复制到写作软件</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/outline')}
            className="rounded border border-ink-300 px-3 py-1.5 text-sm hover:bg-ink-200/50"
          >
            ← 返回编辑
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse rounded border border-ink-300 p-8 text-center text-sm text-ink-600">
          正在组装大纲…
        </div>
      ) : chapters.length === 0 ? (
        <div className="rounded border border-dashed border-ink-300 p-8 text-center text-sm text-ink-600">
          还没有章节内容，请先回到阶段三构建骨架并生成章节。
          <div className="mt-3">
            <button
              onClick={() => navigate('/outline')}
              className="rounded cyber-btn px-4 py-1.5 text-sm"
            >
              去构建骨架 →
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <DownloadBtn filename="小说大纲.md" content={md} label="下载 Markdown (.md)" />
            <DownloadBtn filename="小说大纲.txt" content={txt} label="下载纯文本 (.txt)" />
            <CopyBtn content={md} label="复制 Markdown" />
            <CopyBtn content={txt} label="复制纯文本" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <article className="rounded border border-ink-300 cyber-surface p-5">
              <h3 className="mb-2 text-sm font-semibold text-ink-700 neon-text">Markdown 预览</h3>
              <pre className="whitespace-pre-wrap text-xs leading-6 text-ink-900 font-retro max-h-[70vh] overflow-auto">
                {md}
              </pre>
            </article>
            <article className="rounded border border-ink-300 cyber-surface p-5">
              <h3 className="mb-2 text-sm font-semibold text-ink-700 neon-text">纯文本预览</h3>
              <pre className="whitespace-pre-wrap text-xs leading-6 text-ink-900 font-retro max-h-[70vh] overflow-auto">
                {txt}
              </pre>
            </article>
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadBtn({
  filename,
  content,
  label,
}: {
  filename: string
  content: string
  label: string
}) {
  return (
    <button
      onClick={() => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }}
      className="rounded cyber-btn px-4 py-1.5 text-sm"
    >
      {label}
    </button>
  )
}

function CopyBtn({ content, label }: { content: string; label: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content)
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = content
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
          setOk(true)
          setTimeout(() => setOk(false), 1500)
        }
      }}
      className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
    >
      {ok ? '✓ 已复制' : label}
    </button>
  )
}

/* =============== 构建 Markdown =============== */
function buildMarkdown({
  chapters,
  characters,
  cards,
  nodes,
  templateName,
}: {
  chapters: Chapter[]
  characters: Character[]
  cards: Card[]
  nodes: string[]
  templateName: string
}) {
  const date = new Date()
  const today = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const lines: string[] = []
  lines.push('# 小说大纲')
  lines.push('')
  lines.push(`- 生成日期：${today}`)
  lines.push(`- 结构模板：${templateName}`)
  lines.push(`- 结构节点：${nodes.join(' → ')}`)
  lines.push(`- 章节数：${chapters.length} 章，角色数：${characters.length}，灵感卡片：${cards.length}`)
  lines.push('')
  lines.push('## 一、角色表')
  lines.push('')
  if (characters.length === 0) {
    lines.push('（暂无，请回到阶段二识别角色）')
  } else {
    lines.push('| 角色 | 提及次数 | 冲突标签 | 代表描述 |')
    lines.push('| --- | --- | --- | --- |')
    for (const c of characters) {
      lines.push(
        `| ${escapeMD(c.name)} | ${c.mentionCount} | ${escapeMD(c.conflictTag ?? '-')} | ${escapeMD(
          c.representativeDesc ?? '-',
        )} |`,
      )
    }
  }
  lines.push('')
  lines.push('## 二、章节规划')
  lines.push('')
  // 按 node 分组
  const byNode: Record<string, Chapter[]> = {}
  nodes.forEach((n) => (byNode[n] = []))
  chapters.forEach((ch) => {
    if (!byNode[ch.nodeId]) byNode[ch.nodeId] = []
    byNode[ch.nodeId].push(ch)
  })
  for (const node of nodes) {
    const list = byNode[node] ?? []
    lines.push(`### ${node}`)
    lines.push('')
    if (list.length === 0) {
      lines.push('_（该节点暂无章节）_')
    }
    for (const ch of list) {
      lines.push(`#### 第 ${ch.index + 1} 章 · ${escapeMD(ch.title)}`)
      lines.push('')
      lines.push(`**核心冲突**：${escapeMD(ch.conflict)}`)
      lines.push('')
      if (ch.cardIds.length > 0) {
        lines.push('**分配灵感卡**：')
        lines.push('')
        for (const cid of ch.cardIds) {
          const c = cards.find((x) => x.id === cid)
          if (!c) continue
          const quote = c.content.replace(/\n/g, '  \n> ')
          lines.push(`- \`${cid.slice(0, 8)}\` ${escapeMD(quote)}`)
        }
        lines.push('')
      }
    }
    lines.push('')
  }
  lines.push('## 三、全部灵感卡片索引')
  lines.push('')
  if (cards.length === 0) {
    lines.push('_（无）_')
  } else {
    cards.forEach((c, i) => {
      lines.push(`### #${i + 1}（${c.id.slice(0, 8)}）`)
      lines.push('')
      lines.push(c.content)
      lines.push('')
    })
  }
  return lines.join('\n')
}

function buildPlainText(md: string): string {
  // 简易去除 Markdown 标记：# | - 等保留结构即可
  return md
    .replace(/^#+ /gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
}

function pad(n: number) {
  return n < 10 ? '0' + n : String(n)
}

function escapeMD(s: string): string {
  return (s ?? '').replace(/\|/g, '\\|')
}
