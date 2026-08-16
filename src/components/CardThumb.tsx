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
}

export function CardThumb({ card, characterName, onClick, onDoubleClick, mobile }: Props) {
  const lines = mobile ? 4 : 2
  return (
    <div
      data-testid="card-thumb"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="cursor-pointer rounded border border-ink-200 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p
        className="text-sm text-ink-800"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {card.content}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {characterName && (
          <span className="rounded border border-ink-200 px-1.5 py-0.5 text-xs text-ink-600">
            #{characterName}
          </span>
        )}
        {card.stage && card.stage !== 'none' && (
          <span className="rounded border border-ink-200 px-1.5 py-0.5 text-xs text-ink-600">
            [{stageLabel[card.stage]}]
          </span>
        )}
        <span className="ml-auto text-xs text-ink-400">{timeAgo(card.createdAt)}</span>
      </div>
    </div>
  )
}
