import type { Card } from '@/types'

const stageLabel: Record<string, string> = {
  pre: '前期',
  mid: '中期',
  post: '后期',
  none: '',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  const day = Math.floor(hr / 24)
  return `${day}天前`
}

interface Props {
  card: Card
  characterName?: string
  onClick?: () => void
  onDoubleClick?: () => void
  mobile?: boolean
  onEdit?: () => void
  onDelete?: () => void
  /** 处于拖拽容器内时隐藏按钮，避免与拖拽手势冲突 */
  hideActions?: boolean
}

export function CardThumb({ card, characterName, onClick, onDoubleClick, mobile, onEdit, onDelete, hideActions }: Props) {
  const bodyLines = mobile ? 4 : 2
  const displayTitle = card.title || '（无标题）'
  const hasBody = card.content && card.content.trim().length > 0

  return (
    <div
      data-testid="card-thumb"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="group relative cursor-pointer rounded border border-ink-300 cyber-surface p-3 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* 右上角操作按钮（hover 显示，移动端常显） */}
      {!hideActions && (onEdit || onDelete) && (
        <div className="card-actions absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              data-testid={`card-edit-btn-${card.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title="编辑"
              className="flex h-6 w-6 items-center justify-center rounded border border-ink-300 bg-ink-100/80 text-xs text-ink-700 hover:bg-accent-periwinkle/25 hover:text-ink-900"
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              data-testid={`card-delete-btn-${card.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              title="删除"
              className="flex h-6 w-6 items-center justify-center rounded border border-ink-300 bg-ink-100/80 text-xs text-ink-700 hover:bg-semantic-error/30 hover:text-ink-900"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* 标题 */}
      <p className="mb-1 pr-12 text-sm font-semibold text-ink-800 neon-text line-clamp-1 font-cute">
        {displayTitle}
      </p>

      {/* 正文（截断显示） */}
      {hasBody && (
        <p
          className="text-sm text-ink-600"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: bodyLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.content}
        </p>
      )}

      {/* 标签栏 */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {characterName && (
          <span className="pixel-badge pixel-badge-gray">
            #{characterName}
          </span>
        )}
        {card.stage && card.stage !== 'none' && (
          <span className="pixel-badge pixel-badge-gray">
            [{stageLabel[card.stage]}]
          </span>
        )}
        {card.isForeshadow && (
          <span className="pixel-badge pixel-badge-purple">
            🔖伏笔
          </span>
        )}
        {typeof card.emotion === 'number' && card.emotion !== 0 && (
          <span className="pixel-badge pixel-badge-gray">
            情绪{card.emotion > 0 ? '+' : ''}{card.emotion}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-500">{timeAgo(card.createdAt)}</span>
      </div>
    </div>
  )
}
