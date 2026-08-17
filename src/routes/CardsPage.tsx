import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { useCardStore } from '@/stores/cardStore'
import { useBookStore } from '@/stores/bookStore'
import { CardThumb } from '@/components/CardThumb'
import { CardEditModal } from '@/components/CardEditModal'
import { EmptyState, CardDetailModal } from '@/components/EmptyState'
import { BackupRestore } from '@/components/BackupRestore'
import { SAMPLE_CARDS } from '@/data/sampleCards'
import type { Card } from '@/types'

// 卡片数量超过此阈值时启用虚拟列表，避免大量 DOM 渲染卡顿
const VIRTUAL_THRESHOLD = 30
// 单行卡片高度估值（含 gap），用于虚拟化估算
const ROW_ESTIMATE = 168

const ONBOARDING_KEY = 'onboarding-completed'

export function CardsPage() {
  const navigate = useNavigate()
  const { cards, loading, loadAll, create, edit, remove } = useCardStore()
  const { books, currentBookId, loadAll: loadBooks, create: createBook, setCurrent } = useBookStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showNewBook, setShowNewBook] = useState(false)
  const [newBookTitle, setNewBookTitle] = useState('')
  const [editing, setEditing] = useState<Card | null>(null)
  const [detail, setDetail] = useState<Card | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [confirmSort, setConfirmSort] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null)
  // 虚拟列表：列数响应式（与 Tailwind 配置 sm=768/lg=1024 断点一致）
  const [colCount, setColCount] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth >= 1024
        ? 4
        : window.innerWidth >= 768
          ? 2
          : 1
      : 1,
  )

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setColCount(w >= 1024 ? 4 : w >= 768 ? 2 : 1)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    ;(async () => {
      await loadBooks()
      await loadAll()
      // 首次访问且无任何卡片时，提示是否载入示例数据
      const done = localStorage.getItem(ONBOARDING_KEY)
      if (!done && useCardStore.getState().cards.length === 0) {
        setShowOnboarding(true)
      }
    })()
  }, [loadBooks, loadAll])

  // 同步 currentBookId 到 cardStore 的 filterBookId
  useEffect(() => {
    useCardStore.getState().setBookFilter(currentBookId)
  }, [currentBookId])

  // 键盘快捷键：Ctrl/Cmd+N 新建卡片
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        setShowCreate(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleLoadSample = async () => {
    // 创建一本示例书，把示例卡片都关联到该书
    const book = await createBook('示例：玉佩之约')
    setCurrent(book.id)
    for (const seed of SAMPLE_CARDS) {
      await create({ ...seed, bookId: book.id })
    }
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  const handleSkipOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  const visible = useCardStore((s) => s.visibleCards())

  // 虚拟列表：按行虚拟化，行数 = ceil(卡片数 / 列数)
  const rowCount = Math.max(0, Math.ceil(visible.length / Math.max(1, colCount)))
  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 3,
  })
  const shouldVirtualize = visible.length > VIRTUAL_THRESHOLD

  const handleSort = () => {
    if (cards.length < 5) {
      setConfirmSort(true)
      return
    }
    navigate('/sort')
  }

  const handleSortConfirm = () => {
    setConfirmSort(false)
    navigate('/sort')
  }

  // 阶段一导出：把当前可见卡片导出为 Markdown 灵感清单
  const handleExportCards = () => {
    const list = visible
    if (list.length === 0) return
    const stageLabel: Record<string, string> = {
      pre: '前期',
      mid: '中期',
      post: '后期',
      none: '未分类',
    }
    const date = new Date()
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const lines: string[] = []
    lines.push('# 灵感卡片清单')
    lines.push('')
    lines.push(`- 导出日期：${today}`)
    lines.push(`- 来源书籍：${currentBook?.title ?? '全部书籍'}`)
    lines.push(`- 卡片总数：${list.length}`)
    lines.push('')
    list.forEach((c, i) => {
      lines.push(`## #${i + 1} · ${c.title || '（无标题）'}`)
      lines.push('')
      lines.push(`- 阶段：${stageLabel[c.stage ?? 'none']}`)
      if (typeof c.emotion === 'number') lines.push(`- 情绪值：${c.emotion > 0 ? '+' : ''}${c.emotion}`)
      if (typeof c.intensity === 'number') lines.push(`- 冲突强度：${c.intensity}`)
      if (c.isForeshadow) lines.push(`- 伏笔：${c.foreshadowResolved ? '已回收' : '未回收'}`)
      lines.push('')
      if (c.content) {
        lines.push(c.content)
        lines.push('')
      }
    })
    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `灵感清单-${today}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCreateBook = async () => {
    if (!newBookTitle.trim()) return
    const book = await createBook(newBookTitle.trim())
    setCurrent(book.id)
    setNewBookTitle('')
    setShowNewBook(false)
  }

  const currentBook = books.find((b) => b.id === currentBookId)

  return (
    <div>
      {/* 书籍选择器 + 工具栏 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* 书籍下拉 */}
          <select
            data-testid="book-selector"
            value={currentBookId ?? ''}
            onChange={(e) => setCurrent(e.target.value || null)}
            className="rounded border border-ink-300 px-3 py-1.5 text-sm focus:outline-none focus:border-ink-500"
          >
            <option value="">全部书籍</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewBook(!showNewBook)}
            className="rounded border border-ink-300 px-3 py-1.5 text-sm hover:bg-ink-200/50"
          >
            + 新建书籍
          </button>
          {showNewBook && (
            <div className="flex items-center gap-1">
              <input
                data-testid="new-book-input"
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateBook()}
                className="w-40 rounded border border-ink-300 px-2 py-1.5 text-sm focus:outline-none focus:border-ink-500"
                placeholder="书名…"
                autoFocus
              />
              <button
                data-testid="new-book-confirm"
                onClick={handleCreateBook}
                className="rounded cyber-btn px-3 py-1.5 text-sm"
              >
                确定
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded cyber-btn px-4 py-1.5 text-sm"
          >
            + 新卡片
          </button>
          <button
            onClick={handleSort}
            className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
          >
            一键梳理 →
          </button>
          <button
            data-testid="export-cards-btn"
            onClick={handleExportCards}
            disabled={visible.length === 0}
            className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50 disabled:opacity-40"
            title="把当前可见的灵感卡片导出为 Markdown"
          >
            导出清单
          </button>
        </div>
      </div>

      {/* 当前书籍提示 */}
      {currentBook && (
        <div className="mb-3 text-xs text-ink-600">
          当前书籍：<span className="font-semibold text-ink-800 neon-text">{currentBook.title}</span>
        </div>
      )}

      {/* 备份/恢复 */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-ink-200 bg-ink-100/30 px-3 py-2">
        <span className="text-xs text-ink-500">数据备份：</span>
        <BackupRestore
          onRestored={async () => {
            await loadBooks()
            await loadAll()
          }}
        />
      </div>

      {/* 卡片区 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded border border-ink-100 bg-ink-100/50" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          count={cards.length}
          actionLabel="+ 新建第一张卡片"
          onAction={() => setShowCreate(true)}
        />
      ) : shouldVirtualize ? (
        // 虚拟列表：大量卡片时只渲染可视区域内的行，避免 DOM 堆积卡顿
        <div
          data-testid="card-grid-virtual"
          style={{
            position: 'relative',
            width: '100%',
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((row) => {
            const start = row.index * colCount
            const rowCards = visible.slice(start, start + colCount)
            return (
              <div
                key={row.key}
                data-row-index={row.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${row.start}px)`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                  gap: '0.75rem',
                  paddingBottom: '0.75rem',
                }}
              >
                {rowCards.map((card) => (
                  <CardThumb
                    key={card.id}
                    card={card}
                    onClick={() => setDetail(card)}
                    onDoubleClick={() => setEditing(card)}
                    onEdit={() => setEditing(card)}
                    onDelete={() =>
                      setPendingDelete({ id: card.id, title: card.title || '（无标题）' })
                    }
                  />
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((card) => (
            <CardThumb
              key={card.id}
              card={card}
              onClick={() => setDetail(card)}
              onDoubleClick={() => setEditing(card)}
              onEdit={() => setEditing(card)}
              onDelete={() => setPendingDelete({ id: card.id, title: card.title || '（无标题）' })}
            />
          ))}
        </div>
      )}

      {/* 底部状态栏 */}
      <div className="mt-4 border-t border-ink-200 pt-2 text-xs text-ink-500">
        共 {visible.length} 张卡片{currentBook ? `（${currentBook.title}）` : '（全部书籍）'}
      </div>

      {/* 弹窗 */}
      {showOnboarding && (
        <div
          data-testid="onboarding-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={handleSkipOnboarding}
        >
          <div
            className="w-full max-w-md rounded cyber-modal p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-base font-semibold font-cute neon-text">
              欢迎来到小说大纲梳理器
            </h2>
            <p className="mb-4 text-sm text-ink-600">
              这是一个帮你把零散灵感整理成结构化大纲的小工具。
              <br />
              <br />
              你可以：
              <br />
              · 录入灵感卡片（标题 + 正文 + 情绪 + 伏笔）
              <br />
              · 一键梳理叙事线、角色、伏笔、情绪
              <br />
              · 生成章节骨架并导出 Markdown
              <br />
              <br />
              首次使用要不要载入一份示例数据看看效果？
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="onboarding-skip-btn"
                onClick={handleSkipOnboarding}
                className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
              >
                不用了，我自己来
              </button>
              <button
                data-testid="onboarding-load-btn"
                onClick={handleLoadSample}
                className="rounded cyber-btn px-4 py-1.5 text-sm"
              >
                载入示例
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreate && (
        <CardEditModal
          onSave={async (input) => {
            await create({ ...input, bookId: currentBookId ?? undefined })
            setShowCreate(false)
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {editing && (
        <CardEditModal
          initial={editing}
          onSave={async (input) => {
            await edit(editing.id, input)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {detail && (
        <CardDetailModal
          card={detail}
          onEdit={() => {
            setEditing(detail)
            setDetail(null)
          }}
          onDelete={async () => {
            await remove(detail.id)
            setDetail(null)
          }}
          onClose={() => setDetail(null)}
        />
      )}

      {/* 确认：卡片数少仍要梳理 */}
      {confirmSort && (
        <div
          data-testid="confirm-sort-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmSort(false)}
        >
          <div
            className="w-full max-w-sm rounded cyber-modal p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold font-cute neon-text">提示</h3>
            <p className="mb-4 text-sm text-ink-600">
              当前灵感还比较少（{cards.length} 张），梳理效果可能有限，确定继续吗？
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmSort(false)}
                className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
              >
                取消
              </button>
              <button
                onClick={handleSortConfirm}
                className="rounded cyber-btn px-4 py-1.5 text-sm"
              >
                确定继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认：删除卡片 */}
      {pendingDelete && (
        <div
          data-testid="confirm-delete-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded cyber-modal p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold font-cute neon-text">确认删除</h3>
            <p className="mb-4 text-sm text-ink-600">
              确定删除卡片「{pendingDelete.title}」？此操作不可恢复。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await remove(pendingDelete.id)
                  setPendingDelete(null)
                }}
                className="rounded border border-red-500/60 bg-red-500/15 px-4 py-1.5 text-sm text-red-400 hover:bg-red-500/25"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
