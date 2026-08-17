import { useState, useRef } from 'react'
import { db } from '@/db/database'

interface BackupData {
  __type: 'novel-outline-backup'
  version: number
  exportedAt: string
  tables: {
    books: unknown[]
    cards: unknown[]
    characters: unknown[]
    links: unknown[]
    chapters: unknown[]
  }
}

/**
 * 数据备份/恢复组件
 * - 导出：把 IndexedDB 中所有表序列化为 JSON 下载
 * - 导入：读取 JSON 文件，校验后覆盖写入 IndexedDB
 */
export function BackupRestore({ onRestored }: { onRestored?: () => void }) {
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setBusy('export')
    setMsg(null)
    try {
      const [books, cards, characters, links, chapters] = await Promise.all([
        db.books.toArray(),
        db.cards.toArray(),
        db.characters.toArray(),
        db.links.toArray(),
        db.chapters.toArray(),
      ])
      const data: BackupData = {
        __type: 'novel-outline-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        tables: { books, cards, characters, links, chapters },
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      a.href = url
      a.download = `novel-outline-backup-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg({ type: 'ok', text: `已导出 ${cards.length} 张卡片 / ${characters.length} 个角色` })
    } catch (e) {
      setMsg({ type: 'err', text: `导出失败：${(e as Error).message}` })
    } finally {
      setBusy(null)
    }
  }

  const handleImport = async (file: File) => {
    setBusy('import')
    setMsg(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Partial<BackupData>
      if (!parsed || parsed.__type !== 'novel-outline-backup' || !parsed.tables) {
        throw new Error('文件格式不正确（缺少 __type 或 tables 字段）')
      }
      const t = parsed.tables
      if (!Array.isArray(t.books) || !Array.isArray(t.cards)) {
        throw new Error('数据结构不完整')
      }

      const totalCards = t.cards.length
      const totalChars = (t.characters ?? []).length
      const ok = confirm(
        `确认导入备份？\n\n将覆盖当前数据：\n  - ${totalCards} 张卡片\n  - ${totalChars} 个角色\n  - ${(t.books ?? []).length} 本书\n  - ${(t.links ?? []).length} 条伏笔关联\n  - ${(t.chapters ?? []).length} 章\n\n此操作不可撤销。`,
      )
      if (!ok) {
        setMsg({ type: 'err', text: '已取消导入' })
        return
      }

      await db.transaction('rw', db.books, db.cards, db.characters, db.links, db.chapters, async () => {
        await Promise.all([
          db.books.clear(),
          db.cards.clear(),
          db.characters.clear(),
          db.links.clear(),
          db.chapters.clear(),
        ])
        await Promise.all([
          db.books.bulkPut(t.books as never[]),
          db.cards.bulkPut(t.cards as never[]),
          db.characters.bulkPut((t.characters ?? []) as never[]),
          db.links.bulkPut((t.links ?? []) as never[]),
          db.chapters.bulkPut((t.chapters ?? []) as never[]),
        ])
      })
      setMsg({ type: 'ok', text: `已导入 ${totalCards} 张卡片 / ${totalChars} 个角色` })
      onRestored?.()
    } catch (e) {
      setMsg({ type: 'err', text: `导入失败：${(e as Error).message}` })
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        data-testid="backup-export-btn"
        onClick={handleExport}
        disabled={busy !== null}
        className="rounded border border-ink-300 px-3 py-1.5 text-xs hover:bg-ink-200/50 disabled:opacity-50"
      >
        {busy === 'export' ? '导出中…' : '导出备份'}
      </button>
      <button
        data-testid="backup-import-btn"
        onClick={() => fileRef.current?.click()}
        disabled={busy !== null}
        className="rounded border border-ink-300 px-3 py-1.5 text-xs hover:bg-ink-200/50 disabled:opacity-50"
      >
        {busy === 'import' ? '导入中…' : '导入恢复'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImport(f)
        }}
      />
      {msg && (
        <span
          className={
            'text-xs ' + (msg.type === 'ok' ? 'text-semantic-success' : 'text-semantic-error')
          }
        >
          {msg.text}
        </span>
      )}
    </div>
  )
}
