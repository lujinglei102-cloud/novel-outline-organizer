import { useState, useEffect } from 'react'
import type { Card, Stage } from '@/types'

const MAX_TITLE_LEN = 100
const MAX_BODY_LEN = 500

interface Props {
  initial?: Card
  characterName?: string
  onSave: (input: {
    title: string
    content: string
    characterId?: string
    stage?: Stage
    emotion?: number
    intensity?: number
    emotionManual?: boolean
    isForeshadow?: boolean
  }) => void
  onCancel: () => void
}

export function CardEditModal({ initial, characterName, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [stage, setStage] = useState<Stage>(initial?.stage ?? 'none')
  const [emotion, setEmotion] = useState(initial?.emotion ?? 0)
  const [intensity, setIntensity] = useState(initial?.intensity ?? 1)
  const [isForeshadow, setIsForeshadow] = useState(initial?.isForeshadow ?? false)
  const [hasInput, setHasInput] = useState(false)

  useEffect(() => {
    setHasInput(title.trim().length > 0)
  }, [title])

  const remainingTitle = MAX_TITLE_LEN - title.length
  const remainingBody = MAX_BODY_LEN - content.length

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title,
      content,
      characterId: initial?.characterId,
      stage,
      emotion,
      intensity,
      emotionManual: true,
      isForeshadow,
    })
  }

  return (
    <div
      data-testid="card-edit-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded cyber-modal p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold font-cute neon-text">
            {initial ? '编辑灵感卡片' : '新建灵感卡片'}
          </h2>
          <button onClick={onCancel} className="text-ink-400 hover:text-ink-700">
            ×
          </button>
        </div>

        {/* 标题 */}
        <label className="mb-1 block text-xs text-ink-500">
          标题（必填，最多 {MAX_TITLE_LEN} 字）
        </label>
        <input
          data-testid="card-title-input"
          type="text"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LEN))}
          className="mb-1 w-full rounded border border-ink-400 cyber-input px-2 py-1.5 text-sm font-medium"
          placeholder="给这条灵感起个标题…"
        />
        <div className="mb-3 text-right text-xs text-ink-400">剩余 {remainingTitle} 字</div>

        {/* 正文 */}
        <label className="mb-1 block text-xs text-ink-500">
          正文（可选，最多 {MAX_BODY_LEN} 字）
        </label>
        <textarea
          data-testid="card-content-input"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_BODY_LEN))}
          className="h-28 w-full resize-none rounded border border-ink-400 cyber-input p-2 text-sm"
          placeholder="详细描述这个灵感……"
        />
        <div className="mt-1 text-right text-xs text-ink-400">剩余 {remainingBody} 字</div>

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

        {/* 情绪值 */}
        <div className="mt-3">
          <label className="mb-1 block text-xs text-ink-500">
            情绪值：{emotion}（-5 极度负面 / 0 中性 / 5 极度正面）
          </label>
          <input
            data-testid="card-emotion-input"
            type="range"
            min={-5}
            max={5}
            step={1}
            value={emotion}
            onChange={(e) => setEmotion(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 冲突强度 */}
        <div className="mt-2">
          <label className="mb-1 block text-xs text-ink-500">冲突强度：{intensity}（1~5，越大冲突越激烈）</label>
          <input
            data-testid="card-intensity-input"
            type="range"
            min={1}
            max={5}
            step={1}
            value={intensity}
            onChange={(e) => setIntensity(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 伏笔标记 */}
        <div className="mt-3 flex items-center gap-2">
          <input
            data-testid="card-foreshadow-checkbox"
            type="checkbox"
            checked={isForeshadow}
            onChange={(e) => setIsForeshadow(e.target.checked)}
            className="h-4 w-4"
          />
          <label className="text-sm text-ink-700" onClick={() => setIsForeshadow(!isForeshadow)}>
            🔖 标记为伏笔（这条灵感包含需要后续回收的伏笔）
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
          >
            取消
          </button>
          <button
            data-testid="card-save-btn"
            onClick={handleSave}
            disabled={!hasInput}
            className="rounded cyber-btn px-4 py-1.5 text-sm disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
