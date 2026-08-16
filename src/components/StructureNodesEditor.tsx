import { useState } from 'react'

interface Props {
  nodes: string[]
  onChange: (nodes: string[]) => void
  onSelectIndex?: (idx: number | null) => void
  selectedIndex?: number | null
  boundaries?: number[] // 每个节点对应的卡片分界数量，长度 nodes.length
  totalCards?: number
  addLabel?: string
}

export function StructureNodesEditor({
  nodes,
  onChange,
  onSelectIndex,
  selectedIndex,
  boundaries,
  totalCards = 0,
  addLabel = '添加节点',
}: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [newName, setNewName] = useState('')

  function boundaryFor(idx: number): { start: number; end: number; count: number } {
    if (!boundaries || boundaries.length === 0) {
      return { start: 0, end: 0, count: 0 }
    }
    const start = idx === 0 ? 0 : boundaries[idx - 1]
    const end = boundaries[idx] ?? (boundaries[boundaries.length - 1] ?? 0)
    return { start, end, count: end - start }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {nodes.map((n, idx) => {
          const b = boundaryFor(idx)
          const active = selectedIndex === idx
          return (
            <div
              key={idx}
              onClick={() => onSelectIndex?.(active ? null : idx)}
              className={
                'group flex items-center gap-1 rounded border px-3 py-1.5 text-sm ' +
                (active
                  ? 'border-accent-periwinkle bg-accent-periwinkle/20 text-ink-800'
                  : 'border-ink-300 cyber-surface hover:border-ink-400 cursor-pointer')
              }
            >
              {editing === idx ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    const next = [...nodes]
                    next[idx] = draft.trim() || next[idx]
                    onChange(next)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const next = [...nodes]
                      next[idx] = draft.trim() || next[idx]
                      onChange(next)
                      setEditing(null)
                    }
                  }}
                  className={
                    'w-24 rounded border border-ink-300 px-1 text-sm ' +
                    (active ? 'text-ink-900' : '')
                  }
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="font-medium">{n}</span>
              )}
              {typeof boundaries?.[idx] === 'number' && (
                <span
                  className={
                    'ml-1 rounded px-1 text-xs ' +
                    (active ? 'bg-accent-periwinkle/30 text-ink-700' : 'bg-ink-100/50 text-ink-500')
                  }
                >
                  {b.count ?? 0}张
                </span>
              )}
              <button
                title="重命名"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditing(idx)
                  setDraft(nodes[idx])
                }}
                className={
                  'ml-1 hidden text-xs opacity-60 group-hover:inline ' +
                  (active ? 'text-ink-700' : '')
                }
              >
                ✎
              </button>
              {nodes.length > 1 && (
                <button
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`删除节点「${nodes[idx]}」？`)) {
                      const next = [...nodes]
                      next.splice(idx, 1)
                      onChange(next)
                    }
                  }}
                  className={
                    'ml-1 hidden text-xs opacity-60 group-hover:inline ' +
                    (active ? 'text-ink-700' : 'text-red-500')
                  }
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              onChange([...nodes, newName.trim()])
              setNewName('')
            }
          }}
          placeholder={addLabel}
          className="w-48 rounded border border-ink-400 cyber-input px-2 py-1 text-sm"
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              onChange([...nodes, newName.trim()])
              setNewName('')
            }
          }}
          className="rounded border border-ink-300 px-3 py-1 text-xs hover:bg-ink-200/50"
        >
          + 添加
        </button>
        {typeof totalCards === 'number' && boundaries && boundaries.length > 0 && (
          <span className="ml-2 text-xs text-ink-400">
            共 {totalCards} 张卡片已分配
          </span>
        )}
      </div>
    </div>
  )
}
