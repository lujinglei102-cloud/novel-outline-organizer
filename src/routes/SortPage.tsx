import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCardStore } from '@/stores/cardStore'
import { useSortStore } from '@/stores/sortStore'
import { CardThumb } from '@/components/CardThumb'
import { EmotionCurve } from '@/components/EmotionCurve'
import type { Character, Link, SortGap } from '@/types'
import type { TurningPoint } from '@/engine/narrativeLine'

const TABS = [
  { id: 'line', label: '叙事线排序' },
  { id: 'chars', label: '角色识别' },
  { id: 'links', label: '伏笔关联' },
  { id: 'emotion', label: '情绪标注' },
] as const
type TabId = (typeof TABS)[number]['id']

export function SortPage() {
  const navigate = useNavigate()
  const cards = useCardStore((s) => s.cards)
  const loadCards = useCardStore((s) => s.loadAll)

  const {
    runSort,
    sortedCards,
    gaps,
    turningPoints,
    runCharacters,
    removeCharacter,
    renameCharacter,
    characters,
    cardCharacterMap,
    runLinks,
    links,
    runEmotionRetag,
    saveTagToCard,
    emotionSeries,
    loadPersisted,
    reorderCards,
  } = useSortStore()

  const [tab, setTab] = useState<TabId>('line')
  const [loadingTabs, setLoadingTabs] = useState<Set<TabId>>(new Set())
  const [highlightCardId, setHighlightCardId] = useState<string | null>(null)

  useEffect(() => {
    loadCards()
    loadPersisted()
    // 页面进入默认执行一次排序
    if (cards.length > 0 && sortedCards.length === 0) {
      runSort()
    }
  }, [loadCards, loadPersisted]) // eslint-disable-line

  async function ensureTab(id: TabId) {
    setTab(id)
    if (loadingTabs.has(id)) return
    setLoadingTabs((s) => new Set(s).add(id))
    try {
      if (id === 'line') await runSort()
      if (id === 'chars') await runCharacters(sortedCards.length ? sortedCards : undefined)
      if (id === 'links') await runLinks(sortedCards.length ? sortedCards : undefined)
      if (id === 'emotion') await runEmotionRetag()
    } finally {
      // 保留标记，不反复触发
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">阶段二 · 一键梳理</h1>
          <p className="text-xs text-ink-400">
            按叙事线、角色、伏笔、情绪四个维度整理你的灵感卡片
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/cards')}
            className="rounded border border-ink-200 px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            ← 返回阶段一
          </button>
          <button
            onClick={() => navigate('/outline')}
            className="rounded bg-ink-800 px-4 py-1.5 text-sm text-white hover:bg-ink-700"
          >
            进入骨架构建 →
          </button>
        </div>
      </div>

      {/* Tab Header */}
      <div className="mb-3 flex gap-1 border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => ensureTab(t.id)}
            className={
              '-mb-px border-b-2 px-4 py-2 text-sm transition ' +
              (tab === t.id
                ? 'border-ink-900 font-semibold text-ink-900'
                : 'border-transparent text-ink-500 hover:text-ink-800')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'line' && (
        <NarrativeLineView
          cards={sortedCards}
          gaps={gaps}
          turningPoints={turningPoints}
          totalCount={cards.length}
          onRun={runSort}
          onReorder={reorderCards}
          onHighlight={setHighlightCardId}
          highlightId={highlightCardId}
        />
      )}
      {tab === 'chars' && (
        <CharactersView
          characters={characters}
          cardCharacterMap={cardCharacterMap}
          sortedCards={sortedCards}
          onRun={() => runCharacters(sortedCards.length ? sortedCards : undefined)}
          onRemove={removeCharacter}
          onRename={renameCharacter}
        />
      )}
      {tab === 'links' && (
        <ForeshadowView links={links} onRun={() => runLinks(sortedCards.length ? sortedCards : undefined)} />
      )}
      {tab === 'emotion' && (
        <EmotionView
          sortedCards={sortedCards}
          emotionSeries={emotionSeries}
          onRetag={runEmotionRetag}
          onSaveTag={saveTagToCard}
          highlightCardId={highlightCardId}
          onHighlight={setHighlightCardId}
        />
      )}
    </div>
  )
}

/* =============== 子视图：叙事线 =============== */
function NarrativeLineView({
  cards,
  gaps,
  turningPoints,
  totalCount,
  onRun,
  onReorder,
  onHighlight,
  highlightId,
}: {
  cards: { id: string; title?: string; content: string; createdAt: number; stage?: string }[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
  totalCount: number
  onRun: () => Promise<void>
  onReorder: (from: number, to: number) => Promise<void>
  onHighlight: (id: string | null) => void
  highlightId: string | null
}) {
  const [runing, setRuning] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          已排 {cards.length} / {totalCount} 张卡片
          {turningPoints.length > 0 && (
            <span className="ml-2 text-red-500">⚠ {turningPoints.length} 处转折事件待处理</span>
          )}
          <span className="ml-2 text-ink-400">· 拖拽卡片可调整顺序</span>
        </p>
        <button
          onClick={async () => {
            setRuning(true)
            try {
              await onRun()
            } finally {
              setRuning(false)
            }
          }}
          className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50 disabled:opacity-50"
          disabled={runing}
        >
          ↻ 重新排序
        </button>
      </div>
      {cards.length === 0 ? (
        <div className="rounded border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          暂无卡片，请先在阶段一录入灵感
        </div>
      ) : (
        <ol className="space-y-2">
          {cards.map((c, i) => {
            const gapHere = gaps.find((g) => g.afterIndex === i)
            const tpHere = turningPoints.filter((tp) => tp.afterCardId === c.id)
            const isHi = highlightId === c.id
            const isDragging = dragIndex === i
            const isOver = overIndex === i && dragIndex !== null && dragIndex !== i
            return (
              <li key={c.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setOverIndex(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setOverIndex(i)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (dragIndex !== null && dragIndex !== i) {
                      onReorder(dragIndex, i)
                    }
                    setDragIndex(null)
                    setOverIndex(null)
                  }}
                  onMouseEnter={() => onHighlight(c.id)}
                  onMouseLeave={() => onHighlight(null)}
                  className={
                    'flex items-start gap-3 rounded border p-3 transition cursor-grab active:cursor-grabbing ' +
                    (isDragging
                      ? 'border-blue-500 bg-blue-50 opacity-50 '
                      : isOver
                      ? 'border-green-500 bg-green-50 '
                      : isHi
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-ink-200 bg-white hover:bg-ink-50')
                  }
                >
                  <span className="mt-1 w-6 flex-shrink-0 text-right text-xs text-ink-400 select-none">
                    {i + 1}
                  </span>
                  <span className="mt-1 text-ink-300 select-none">⣿</span>
                  <CardThumb card={c as any} />
                </div>
                {tpHere.map((tp, idx) => (
                  <div
                    key={`${tp.type}-${idx}`}
                    className={
                      'my-2 ml-9 rounded border-l-4 px-3 py-2 text-xs ' +
                      (tp.severity === 'high'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-orange-400 bg-orange-50 text-orange-700')
                    }
                  >
                    {tp.severity === 'high' ? '🔴' : '🟠'} [{tp.type === 'stage_transition' ? '阶段跳跃' : tp.type === 'emotion_shift' ? '情绪翻转' : '转折缺失'}] {tp.hint}
                  </div>
                ))}
                {gapHere && !tpHere.length && (
                  <div
                    className={
                      'my-2 ml-9 rounded border-l-4 px-3 py-2 text-xs ' +
                      (gapHere.density === 'dense'
                        ? 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-red-400 bg-red-50 text-red-700')
                    }
                  >
                    💡 {gapHere.hint}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/* =============== 子视图：角色 =============== */
function CharactersView({
  characters,
  cardCharacterMap,
  sortedCards,
  onRun,
  onRemove,
  onRename,
}: {
  characters: Character[]
  cardCharacterMap: Record<string, string>
  sortedCards: { id: string; title?: string; content: string }[]
  onRun: () => Promise<void>
  onRemove: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
}) {
  const [runing, setRuning] = useState(false)
  const [selCharId, setSelCharId] = useState<string | null>(characters[0]?.id ?? null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const selChar = characters.find((c) => c.id === selCharId)
  const relatedCards = sortedCards.filter(
    (c) => cardCharacterMap[c.id] === (selChar?.name ?? ''),
  )
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          共识别到 {characters.length} 个角色
          <span className="ml-2 text-ink-400">· 可删除误判项或编辑角色名</span>
        </p>
        <button
          onClick={async () => {
            setRuning(true)
            try {
              await onRun()
            } finally {
              setRuning(false)
            }
          }}
          disabled={runing}
          className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50 disabled:opacity-50"
        >
          ↻ 重新识别
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <aside className="rounded border border-ink-200 p-3 lg:col-span-1">
          {characters.length === 0 ? (
            <p className="text-center text-xs text-ink-400">暂无角色</p>
          ) : (
            <ul className="space-y-1.5">
              {characters.map((c) => (
                <li
                  key={c.id}
                  className={
                    'rounded border px-2.5 py-1.5 text-sm transition ' +
                    (selCharId === c.id
                      ? 'border-ink-800 bg-ink-800 text-white'
                      : 'border-ink-100 hover:border-ink-300')
                  }
                >
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setSelCharId(c.id)}
                  >
                    {editingId === c.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onRename(c.id, editName)
                            setEditingId(null)
                          }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full rounded border border-ink-300 px-1.5 py-0.5 text-sm text-ink-800"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                    <span
                      className={
                        'ml-2 flex-shrink-0 text-xs ' +
                        (selCharId === c.id ? 'text-white/70' : 'text-ink-400')
                      }
                    >
                      ×{c.mentionCount}
                    </span>
                  </div>
                  {editingId !== c.id && (
                    <div className="mt-1 flex gap-2 text-xs">
                      <button
                        data-testid={`char-edit-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(c.id)
                          setEditName(c.name)
                        }}
                        className={
                          selCharId === c.id
                            ? 'text-blue-200 hover:text-blue-100'
                            : 'text-blue-600 hover:underline'
                        }
                      >
                        编辑
                      </button>
                      <button
                        data-testid={`char-delete-${c.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`确认删除"${c.name}"？这不是角色名的话可以删掉。`)) {
                            onRemove(c.id)
                            if (selCharId === c.id) setSelCharId(null)
                          }
                        }}
                        className={
                          selCharId === c.id
                            ? 'text-red-200 hover:text-red-100'
                            : 'text-red-600 hover:underline'
                        }
                      >
                        删除
                      </button>
                    </div>
                  )}
                  {c.conflictTag && (
                    <div
                      className={
                        'mt-1 text-xs ' +
                        (selCharId === c.id ? 'text-amber-200' : 'text-amber-700')
                      }
                    >
                      ⚠ {c.conflictTag}
                    </div>
                  )}
                  {c.representativeDesc && (
                    <div
                      className={
                        'mt-1 line-clamp-2 text-xs ' +
                        (selCharId === c.id ? 'text-white/80' : 'text-ink-500')
                      }
                    >
                      「{c.representativeDesc}」
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
        <section className="lg:col-span-2">
          {selChar ? (
            <>
              <h3 className="mb-2 text-base font-semibold">{selChar.name} 的出场卡片</h3>
              {relatedCards.length === 0 ? (
                <p className="rounded border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
                  该角色暂未分配卡片
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {relatedCards.map((c) => (
                    <CardThumb key={c.id} card={c as any} characterName={selChar.name} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-400">请先在左侧选择角色</p>
          )}
        </section>
      </div>
    </div>
  )
}

/* =============== 子视图：伏笔 =============== */
function ForeshadowView({
  links,
  onRun,
}: {
  links: Link[]
  onRun: () => Promise<void>
}) {
  const [runing, setRuning] = useState(false)
  const visible = links.filter((l) => !l.hidden)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          共 {links.length} 条伏笔关联 · 展示 {visible.length} 条
        </p>
        <button
          onClick={async () => {
            setRuning(true)
            try {
              await onRun()
            } finally {
              setRuning(false)
            }
          }}
          disabled={runing}
          className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50 disabled:opacity-50"
        >
          ↻ 重新识别
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="rounded border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          暂未发现伏笔关联，尝试在卡片中加入共同的信物或关键词（如玉佩、日记、项链等）。
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((l) => (
            <li
              key={l.id}
              className={
                'rounded border p-3 text-sm ' +
                (l.confirmed
                  ? 'border-green-300 bg-green-50'
                  : 'border-ink-200 bg-white')
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                  #{l.cardAId.slice(0, 8)}
                </span>
                <span className="text-ink-400">⇌</span>
                <span className="rounded bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                  #{l.cardBId.slice(0, 8)}
                </span>
                <span className="ml-2 text-ink-800">共现词：{l.reason}</span>
                <span className="ml-auto flex gap-2 text-xs">
                  <Badge
                    color={l.confirmed ? 'green' : 'gray'}
                    label={l.confirmed ? '已埋' : '待确认'}
                  />
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Badge({ color, label }: { color: 'green' | 'gray' | 'amber' | 'red'; label: string }) {
  const cls =
    color === 'green'
      ? 'border-green-300 text-green-700 bg-green-50'
      : color === 'amber'
      ? 'border-amber-300 text-amber-700 bg-amber-50'
      : color === 'red'
      ? 'border-red-300 text-red-700 bg-red-50'
      : 'border-ink-200 text-ink-600 bg-ink-50'
  return <span className={`rounded border px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}

/* =============== 子视图：情绪 =============== */
function EmotionView({
  sortedCards,
  emotionSeries,
  onRetag,
  onSaveTag,
  highlightCardId,
  onHighlight,
}: {
  sortedCards: { id: string; content: string; emotion?: number; intensity?: number }[]
  emotionSeries: { x: number; y: number; cardId: string }[]
  onRetag: () => Promise<void>
  onSaveTag: (cardId: string, emotion: number, intensity: number) => Promise<void>
  highlightCardId: string | null
  onHighlight: (id: string | null) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eVal, setEVal] = useState(0)
  const [iVal, setIVal] = useState(1)
  const [loading, setLoading] = useState(false)

  const values = emotionSeries.map((p) => p.y)
  const xLabels = emotionSeries.map((p) => `#${p.x + 1}`)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          已标注 {sortedCards.filter((c) => typeof c.emotion === 'number').length} /{' '}
          {sortedCards.length}
        </p>
        <button
          onClick={async () => {
            setLoading(true)
            try {
              await onRetag()
            } finally {
              setLoading(false)
            }
          }}
          disabled={loading}
          className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50 disabled:opacity-50"
        >
          ↻ 批量重新标注
        </button>
      </div>

      <div className="mb-4 rounded border border-ink-200 p-2">
        <EmotionCurve
          xLabels={xLabels}
          values={values}
          intensity={sortedCards.map((c) => c.intensity ?? 1)}
          onPointClick={(idx) => {
            const c = sortedCards[idx]
            if (c) {
              setEditingId(c.id)
              setEVal(c.emotion ?? 0)
              setIVal(c.intensity ?? 1)
            }
          }}
        />
        <p className="px-1 pb-1 text-[10px] text-ink-400">
          提示：点击曲线上的点可修改对应卡片的情绪值和强度
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedCards.map((c, idx) => {
          const isHi = highlightCardId === c.id
          return (
            <div
              key={c.id}
              onMouseEnter={() => onHighlight(c.id)}
              onMouseLeave={() => onHighlight(null)}
              className={
                'rounded border p-3 transition ' +
                (isHi
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-ink-200 bg-white hover:bg-ink-50')
              }
            >
              <div className="mb-1 flex items-center gap-1 text-[10px] text-ink-400">
                <span>#{idx + 1}</span>
                <span>·</span>
                <span>情绪 {(c.emotion ?? 0).toFixed(0)}</span>
                <span>·</span>
                <span>强度 {c.intensity ?? 1}</span>
                <button
                  onClick={() => {
                    setEditingId(c.id)
                    setEVal(c.emotion ?? 0)
                    setIVal(c.intensity ?? 1)
                  }}
                  className="ml-auto text-xs text-blue-600 hover:underline"
                >
                  改
                </button>
              </div>
              <p className="line-clamp-3 text-sm">{c.content}</p>
            </div>
          )
        })}
      </div>

      {editingId && (
        <EditEmotionDialog
          cardId={editingId}
          defaultEmotion={eVal}
          defaultIntensity={iVal}
          onClose={() => setEditingId(null)}
          onSave={async (e, i) => {
            await onSaveTag(editingId, e, i)
            setEditingId(null)
          }}
        />
      )}
    </div>
  )
}

function EditEmotionDialog({
  cardId,
  defaultEmotion,
  defaultIntensity,
  onClose,
  onSave,
}: {
  cardId: string
  defaultEmotion: number
  defaultIntensity: number
  onClose: () => void
  onSave: (e: number, i: number) => Promise<void>
}) {
  const [e, setE] = useState(defaultEmotion)
  const [i, setI] = useState(defaultIntensity)
  const [busy, setBusy] = useState(false)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold">修改情绪标注</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-ink-500">
            情绪值：{e}（-5 极度负面 / 0 中性 / 5 极度正面）
          </label>
          <input
            type="range"
            min={-5}
            max={5}
            step={1}
            value={e}
            onChange={(ev) => setE(parseInt(ev.target.value))}
            className="w-full"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs text-ink-500">强度：{i}（1~5）</label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={i}
            onChange={(ev) => setI(parseInt(ev.target.value))}
            className="w-full"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-ink-200 px-4 py-1.5 text-sm hover:bg-ink-50"
          >
            取消
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onSave(e, i)
              } finally {
                setBusy(false)
              }
            }}
            className="rounded bg-ink-800 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            保存
          </button>
        </div>
        <div className="mt-3 text-[10px] text-ink-400">
          cardId: {cardId.slice(0, 16)}...
        </div>
      </div>
    </div>
  )
}
