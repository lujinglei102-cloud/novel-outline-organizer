import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCardStore } from '@/stores/cardStore'
import { CardThumb } from '@/components/CardThumb'
import { CardEditModal } from '@/components/CardEditModal'
import { EmptyState, CardDetailModal } from '@/components/EmptyState'
import type { Card } from '@/types'

export function CardsPage() {
  const navigate = useNavigate()
  const { cards, loading, loadAll, create, edit, remove } = useCardStore()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [detail, setDetail] = useState<Card | null>(null)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const visible = useCardStore((s) => s.visibleCards())

  const handleSort = () => {
    if (cards.length < 5) {
      if (!confirm(`当前灵感还比较少（${cards.length} 张），梳理效果可能有限，确定继续吗？`))
        return
    }
    navigate('/sort')
  }

  return (
    <div>
      {/* 工具栏 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setShowCreate(true)}
          className="rounded bg-ink-800 px-4 py-1.5 text-sm text-white hover:bg-ink-700"
        >
          + 新卡片
        </button>
        <button
          onClick={handleSort}
          className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-50"
        >
          一键梳理 →
        </button>
      </div>

      {/* 卡片区 */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded border border-ink-100 bg-ink-50" />
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
        共 {cards.length} 张卡片
      </div>

      {/* 弹窗 */}
      {showCreate && (
        <CardEditModal
          onSave={async (input) => {
            await create(input)
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
