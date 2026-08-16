import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCardStore } from '@/stores/cardStore'
import { useBookStore } from '@/stores/bookStore'
import { CardThumb } from '@/components/CardThumb'
import { CardEditModal } from '@/components/CardEditModal'
import { EmptyState, CardDetailModal } from '@/components/EmptyState'
import type { Card } from '@/types'

export function CardsPage() {
  const navigate = useNavigate()
  const { cards, loading, loadAll, create, edit, remove } = useCardStore()
  const { books, currentBookId, loadAll: loadBooks, create: createBook, setCurrent } = useBookStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showNewBook, setShowNewBook] = useState(false)
  const [newBookTitle, setNewBookTitle] = useState('')
  const [editing, setEditing] = useState<Card | null>(null)
  const [detail, setDetail] = useState<Card | null>(null)

  useEffect(() => {
    loadBooks()
    loadAll()
  }, [loadBooks, loadAll])

  // 同步 currentBookId 到 cardStore 的 filterBookId
  useEffect(() => {
    useCardStore.getState().setBookFilter(currentBookId)
  }, [currentBookId])

  const visible = useCardStore((s) => s.visibleCards())

  const handleSort = () => {
    if (cards.length < 5) {
      if (!confirm(`当前灵感还比较少（${cards.length} 张），梳理效果可能有限，确定继续吗？`))
        return
    }
    navigate('/sort')
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
        </div>
      </div>

      {/* 当前书籍提示 */}
      {currentBook && (
        <div className="mb-3 text-xs text-ink-500">
          当前书籍：<span className="font-medium text-ink-700">{currentBook.title}</span>
        </div>
      )}

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
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((card) => (
            <CardThumb
              key={card.id}
              card={card}
              onClick={() => setDetail(card)}
              onDoubleClick={() => setEditing(card)}
            />
          ))}
        </div>
      )}

      {/* 底部状态栏 */}
      <div className="mt-4 border-t border-ink-100 pt-2 text-xs text-ink-400">
        共 {visible.length} 张卡片{currentBook ? `（${currentBook.title}）` : '（全部书籍）'}
      </div>

      {/* 弹窗 */}
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
    </div>
  )
}
