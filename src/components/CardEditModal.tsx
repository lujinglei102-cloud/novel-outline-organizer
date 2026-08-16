import { useState, useEffect } from 'react'
import type { Card, Stage } from '@/types'

const MAX_LEN = 500

interface Props {
  initial?: Card
  characterName?: string
  onSave: (input: { content: string; characterId?: string; stage?: Stage }) => void
  onCancel: () => void
}

export function CardEditModal({ initial, characterName, onSave, onCancel }: Props) {
  const [content, setContent] = useState(initial?.content ?? '')
  const [stage, setStage] = useState<Stage>(initial?.stage ?? 'none')
  const [hasInput, setHasInput] = useState(false)

  useEffect(() => {
    setHasInput(content.trim().length > 0)
  }, [content])

  const remaining = MAX_LEN - content.length

  const handleSave = () => {
    if (!content.trim()) return
    onSave({
      content,
      characterId: initial?.characterId,
      stage,
    })
  }

  return (
    <div
      data-testid="card-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl rounded bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {initial ? '编辑灵感卡片' : '新建灵感卡片'}
          </h2>
          <button onClick={onCancel} className="text-ink-400 hover:text-ink-700">
            ×
          </button>
        </div>

        <label className="mb-1 block text-xs text-ink-500">
          内容（必填，最多 {MAX_LEN} 字）
        </label>
        <textarea
          data-testid="card-content-input"
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
          className="h-28 w-full resize-none rounded border border-ink-200 p-2 text-sm focus:outline-none focus:border-ink-500"
          placeholder="输入灵感……"
        />
        <div className="mt-1 text-right text-xs text-ink-400">剩余 {remaining} 字</div>

        {characterName && (
          <div className="mt-2 text-xs text-ink-500">关联角色：{characterName}</div>
        )}

        <div className="mt-3">
          <label className="mb-1 block text-xs text-ink-500">所属阶段（可选）</label>
          <div className="flex gap-3 text-sm">
            {(['pre', 'mid', 'post', 'none'] as Stage[]).map((s) => (
              <label key={s} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="stage"
                  checked={stage === s}
                  onChange={() => setStage(s)}
                />
                <span>
                  {s === 'pre' ? '前期' : s === 'mid' ? '中期' : s === 'post' ? '后期' : '未分类'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-ink-200 px-4 py-1.5 text-sm hover:bg-ink-50"
          >
            取消
          </button>
          <button
            data-testid="card-save-btn"
            onClick={handleSave}
            disabled={!hasInput}
            className="rounded bg-ink-800 px-4 py-1.5 text-sm text-white disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
