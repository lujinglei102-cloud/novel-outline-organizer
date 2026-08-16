import type { Card } from '@/types'

interface Props {
  count: number
  message?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ count, message, actionLabel, onAction }: Props) {
  return (
    <div data-testid="empty-state" className="flex flex-col items-center justify-center py-20">
      <div className="mb-4 text-5xl text-ink-200">✎</div>
      <p className="mb-4 text-sm text-ink-500">
        {message ?? `还没有灵感卡片（${count} 张），点左上角「+ 新卡片」开始记录你的第一个想法吧`}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="rounded cyber-btn px-5 py-2 text-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function CardDetailModal({
  card,
  characterName,
  onEdit,
  onDelete,
  onClose,
}: {
  card: Card
  characterName?: string
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <div
      data-testid="card-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded cyber-modal p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold font-cute neon-text">卡片详情</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            ×
          </button>
        </div>
        <h3 className="mb-2 text-lg font-semibold font-cute text-ink-800 neon-text">{card.title || '（无标题）'}</h3>
        {card.content && (
          <p className="whitespace-pre-wrap rounded bg-ink-100/50 p-3 text-sm">{card.content}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-500">
          {characterName && <span>#{characterName}</span>}
          <span>创建于 {new Date(card.createdAt).toLocaleString()}</span>
        </div>
        <div className="mt-5 flex justify-between">
          <button
            onClick={() => {
              if (confirm('删除此卡片？不可恢复')) onDelete()
            }}
            className="rounded border border-ink-300 px-4 py-1.5 text-sm text-ink-700 hover:bg-ink-200/50"
          >
            删除
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
            >
              关闭
            </button>
            <button
              onClick={onEdit}
              className="rounded cyber-btn px-4 py-1.5 text-sm"
            >
              编辑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
