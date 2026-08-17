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
    toggleLinkResolved,
    toggleForeshadowCard,
    runEmotionRetag,
    refreshEmotionSeries,
    restoreManualEmotion,
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
      // 情绪标注：不再自动重新标注，只用当前 sortedCards 的情绪值刷新曲线
      if (id === 'emotion') refreshEmotionSeries()
    } finally {
      // 保留标记，不反复触发
    }
  }

  // 从叙事线排序一键跳转到情绪标注（保留当前情绪值，不重新计算）
  function gotoEmotionTab() {
    refreshEmotionSeries()
    setTab('emotion')
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold font-cute">阶段二 · 一键梳理</h1>
          <p className="text-xs text-ink-400">
            按叙事线、角色、伏笔、情绪四个维度整理你的灵感卡片
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/cards')}
            className="rounded border border-ink-300 px-3 py-1.5 text-sm hover:bg-ink-200/50"
          >
            ← 返回阶段一
          </button>
          <button
            onClick={() => navigate('/outline')}
            className="rounded cyber-btn px-4 py-1.5 text-sm"
          >
            进入骨架构建 →
          </button>
        </div>
      </div>

      {/* Tab Header */}
      <div className="mb-3 flex gap-1 border-b border-ink-300">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => ensureTab(t.id)}
            className={
              '-mb-px border-b-2 px-4 py-2 text-sm transition ' +
              (tab === t.id
                ? 'cyber-tab-active'
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
          onGotoEmotion={gotoEmotionTab}
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
        <ForeshadowView
          links={links}
          manualForeshadowCards={sortedCards.filter((c) => c.isForeshadow)}
          onRun={() => runLinks(sortedCards.length ? sortedCards : undefined)}
          onToggleLinkResolved={toggleLinkResolved}
          onToggleForeshadowCard={toggleForeshadowCard}
        />
      )}
      {tab === 'emotion' && (
        <EmotionView
          sortedCards={sortedCards}
          emotionSeries={emotionSeries}
          onRetag={runEmotionRetag}
          onRestore={restoreManualEmotion}
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
  onGotoEmotion,
}: {
  cards: { id: string; title?: string; content: string; createdAt: number; stage?: string; emotion?: number }[]
  gaps: SortGap[]
  turningPoints: TurningPoint[]
  totalCount: number
  onRun: () => Promise<void>
  onReorder: (from: number, to: number) => Promise<void>
  onHighlight: (id: string | null) => void
  highlightId: string | null
  onGotoEmotion: () => void
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
          <span className="ml-2 text-ink-400">· 拖拽卡片可调整顺序（移动端可用 ↑↓ 按钮）</span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={onGotoEmotion}
            disabled={cards.length === 0}
            className="rounded cyber-btn px-3 py-1 text-xs disabled:opacity-40"
          >
            一键情绪标注 →
          </button>
          <button
            onClick={async () => {
              setRuning(true)
              try {
                await onRun()
              } finally {
                setRuning(false)
              }
            }}
            className="rounded border border-ink-300 px-3 py-1 text-xs hover:bg-ink-200/50 disabled:opacity-50"
            disabled={runing}
          >
            ↻ 重新排序
          </button>
        </div>
      </div>
      {cards.length === 0 ? (
        <div className="rounded border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500">
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
                      ? 'border-accent-periwinkle bg-accent-periwinkle/15 opacity-50 '
                        : isOver
                      ? 'border-green-500 bg-green-900/30 '
                      : isHi
                      ? 'border-accent-periwinkle bg-accent-periwinkle/15'
                      : 'border-ink-300 cyber-surface hover:bg-ink-200/50')
                  }
                >
                  <span className="mt-1 w-6 flex-shrink-0 text-right text-xs text-ink-400 select-none">
                    {i + 1}
                  </span>
                  <span className="mt-1 text-ink-300 select-none">⣿</span>
                  <CardThumb card={c as any} hideActions />
                  {/* ↑↓ 按钮：作为拖拽的备用方案，移动端（HTML5 DnD 不可用）尤其依赖 */}
                  <div className="flex flex-col gap-1 self-center">
                    <button
                      onClick={() => onReorder(i, i - 1)}
                      disabled={i === 0}
                      title="上移"
                      className="flex h-6 w-6 items-center justify-center rounded border border-ink-300 bg-ink-100/80 text-xs text-ink-700 hover:bg-accent-periwinkle/25 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-ink-100/80"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => onReorder(i, i + 1)}
                      disabled={i === cards.length - 1}
                      title="下移"
                      className="flex h-6 w-6 items-center justify-center rounded border border-ink-300 bg-ink-100/80 text-xs text-ink-700 hover:bg-accent-periwinkle/25 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-ink-100/80"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                {tpHere.map((tp, idx) => (
                  <div
                    key={`${tp.type}-${idx}`}
                    className={
                      'my-2 ml-9 rounded border-l-4 px-3 py-2 text-xs ' +
                      (tp.severity === 'high'
                        ? 'border-red-500 bg-red-900/30 text-red-400'
                        : 'border-semantic-warning/60 bg-semantic-warning/15 text-semantic-warning')
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
                        ? 'pixel-badge pixel-badge-amber'
                        : 'pixel-badge pixel-badge-red')
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
          className="rounded border border-ink-300 px-3 py-1 text-xs hover:bg-ink-200/50 disabled:opacity-50"
        >
          ↻ 重新识别
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <aside className="rounded border border-ink-300 p-3 lg:col-span-1">
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
                      ? 'cyber-tab-active'
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
                        className="w-full px-1.5 py-0.5 text-sm cyber-input"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                    <span
                      className={
                        'ml-2 flex-shrink-0 text-xs ' +
                        (selCharId === c.id ? 'text-ink-700' : 'text-ink-400')
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
                            ? 'text-accent-periwinkle hover:text-ink-800'
                            : 'text-accent-periwinkle hover:underline neon-text-cyan'
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
                            : 'text-red-400 hover:underline'
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
                        (selCharId === c.id ? 'text-semantic-warning' : 'text-ink-500')
                      }
                    >
                      ⚠ {c.conflictTag}
                    </div>
                  )}
                  {c.representativeDesc && (
                    <div
                      className={
                        'mt-1 line-clamp-2 text-xs ' +
                        (selCharId === c.id ? 'text-ink-700' : 'text-ink-500')
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
              <h3 className="mb-2 text-base font-semibold font-cute neon-text">{selChar.name} 的出场卡片</h3>
              {relatedCards.length === 0 ? (
                <p className="rounded border border-dashed border-ink-300 p-6 text-center text-sm text-ink-500">
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
  manualForeshadowCards,
  onRun,
  onToggleLinkResolved,
  onToggleForeshadowCard,
}: {
  links: Link[]
  manualForeshadowCards: { id: string; title?: string; content: string; foreshadowResolved?: boolean }[]
  onRun: () => Promise<void>
  onToggleLinkResolved: (id: string) => Promise<void>
  onToggleForeshadowCard: (cardId: string) => Promise<void>
}) {
  const [runing, setRuning] = useState(false)
  const visible = links.filter((l) => !l.hidden)
  const unresolvedLinks = visible.filter((l) => !l.resolved)
  const unresolvedCards = manualForeshadowCards.filter((c) => !c.foreshadowResolved)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          自动关联 {links.length} 条 · 手动标记 {manualForeshadowCards.length} 条
          {(unresolvedLinks.length + unresolvedCards.length) > 0 && (
            <span className="ml-2 text-red-500">
              ⚠ {unresolvedLinks.length + unresolvedCards.length} 条未回收
            </span>
          )}
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
          className="rounded border border-ink-300 px-3 py-1 text-xs hover:bg-ink-200/50 disabled:opacity-50"
        >
          ↻ 重新识别
        </button>
      </div>

      {/* 手动标记的伏笔 */}
      {manualForeshadowCards.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-semibold font-cute text-accent-magenta neon-text">🔖 手动标记的伏笔</h3>
          <ul className="space-y-2">
            {manualForeshadowCards.map((c) => {
              const resolved = c.foreshadowResolved
              return (
                <li
                  key={c.id}
                  className={
                    'rounded border p-3 text-sm ' +
                    (resolved
                      ? 'border-green-500/60 bg-green-900/30'
                      : 'border-red-500/60 bg-red-900/30')
                  }
                >
                  <div className="flex items-center gap-2">
                    {!resolved && <span className="text-red-500 text-base">⚠️</span>}
                    <span className="font-medium text-ink-800">{c.title || '（无标题）'}</span>
                    <Badge color="purple" label="手动标记" />
                    <Badge color={resolved ? 'green' : 'red'} label={resolved ? '已回收' : '未回收'} />
                    <button
                      data-testid={`resolve-card-${c.id}`}
                      onClick={() => onToggleForeshadowCard(c.id)}
                      className="ml-auto rounded border border-ink-300 px-2 py-0.5 text-xs hover:bg-ink-200/50"
                    >
                      {resolved ? '↩ 取消回收' : '✓ 确认回收'}
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-600">{c.content}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 自动识别的伏笔关联 */}
      <h3 className="mb-2 text-sm font-semibold font-cute text-ink-600">🔗 自动关联</h3>
      {visible.length === 0 ? (
        <div className="rounded border border-dashed border-ink-300 p-8 text-center text-sm text-ink-500">
          暂未发现伏笔关联，尝试在卡片中加入共同的信物或关键词（如玉佩、日记、项链等）。
          <br />
          也可以在卡片编辑中手动标记为伏笔。
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((l) => {
            const resolved = l.resolved
            return (
              <li
                key={l.id}
                className={
                  'rounded border p-3 text-sm ' +
                  (resolved
                    ? 'border-green-500/60 bg-green-900/30'
                    : 'border-red-500/60 bg-red-900/30')
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  {!resolved && <span className="text-red-500 text-base">⚠️</span>}
                  <span className="pixel-badge pixel-badge-gray">
                    #{l.cardAId.slice(0, 8)}
                  </span>
                  <span className="text-ink-400">⇌</span>
                  <span className="pixel-badge pixel-badge-gray">
                    #{l.cardBId.slice(0, 8)}
                  </span>
                  <span className="ml-2 text-ink-800">共现词：{l.reason}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs">
                    <Badge
                      color={l.confirmed ? 'green' : 'gray'}
                      label={l.confirmed ? '已埋' : '待确认'}
                    />
                    <Badge color={resolved ? 'green' : 'red'} label={resolved ? '已回收' : '未回收'} />
                    <button
                      data-testid={`resolve-link-${l.id}`}
                      onClick={() => onToggleLinkResolved(l.id)}
                      className="rounded border border-ink-300 px-2 py-0.5 text-xs hover:bg-ink-200/50"
                    >
                      {resolved ? '↩ 取消' : '✓ 回收'}
                    </button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Badge({ color, label }: { color: 'green' | 'gray' | 'amber' | 'red' | 'purple'; label: string }) {
  const cls =
    color === 'green'
      ? 'pixel-badge pixel-badge-green'
      : color === 'amber'
      ? 'pixel-badge pixel-badge-amber'
      : color === 'red'
      ? 'pixel-badge pixel-badge-red'
      : color === 'purple'
      ? 'pixel-badge pixel-badge-purple'
      : 'pixel-badge pixel-badge-gray'
  return <span className={`rounded border px-2 py-0.5 text-xs ${cls}`}>{label}</span>
}

/* =============== 子视图：情绪 =============== */
function EmotionView({
  sortedCards,
  emotionSeries,
  onRetag,
  onRestore,
  onSaveTag,
  highlightCardId,
  onHighlight,
}: {
  sortedCards: { id: string; content: string; emotion?: number; intensity?: number }[]
  emotionSeries: { x: number; y: number; cardId: string }[]
  onRetag: () => Promise<void>
  onRestore: () => Promise<void>
  onSaveTag: (cardId: string, emotion: number, intensity: number) => Promise<void>
  highlightCardId: string | null
  onHighlight: (id: string | null) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eVal, setEVal] = useState(0)
  const [iVal, setIVal] = useState(1)
  const [loading, setLoading] = useState(false)
  const [autoTagged, setAutoTagged] = useState(false) // 是否当前处于自动补标状态

  const values = emotionSeries.map((p) => p.y)
  const xLabels = emotionSeries.map((p) => `#${p.x + 1}`)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-500">
          已标注 {sortedCards.filter((c) => typeof c.emotion === 'number').length} /{' '}
          {sortedCards.length}
          {autoTagged && <span className="ml-2 text-accent-periwinkle">· 当前为自动补标结果</span>}
        </p>
        <div className="flex items-center gap-2">
          <span className="group relative inline-flex">
            <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-ink-300 text-[10px] text-ink-500">
              ?
            </span>
            <span className="pointer-events-none absolute right-0 top-6 z-10 hidden whitespace-nowrap rounded pixel-tooltip group-hover:block">
              由ai自动感知卡片中情绪起伏并标注
            </span>
          </span>
          {autoTagged ? (
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  await onRestore()
                } finally {
                  setLoading(false)
                  setAutoTagged(false)
                }
              }}
              disabled={loading}
              className="rounded border-accent-periwinkle/60 bg-accent-periwinkle/15 px-3 py-1 text-xs text-accent-periwinkle hover:bg-accent-periwinkle/25 disabled:opacity-50"
            >
              ↩ 恢复手动标注
            </button>
          ) : (
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  await onRetag()
                } finally {
                  setLoading(false)
                  setAutoTagged(true)
                }
              }}
              disabled={loading}
              className="rounded border border-ink-300 px-3 py-1 text-xs hover:bg-ink-200/50 disabled:opacity-50"
            >
              ↻ 自动补标
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded border border-ink-300 p-2">
        <EmotionCurve
          xLabels={xLabels}
          values={values}
          conflictValues={sortedCards.map((c) => c.intensity ?? 1)}
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
          提示：点击曲线上的点可修改对应卡片的情绪值和冲突强度
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
                  ? 'border-blue-400 bg-cyan-900/30'
                  : 'border-ink-300 cyber-surface hover:bg-ink-200/50')
              }
            >
              <div className="mb-1 flex items-center gap-1 text-[10px] text-ink-400">
                <span>#{idx + 1}</span>
                <span>·</span>
                <span>情绪 {(c.emotion ?? 0).toFixed(0)}</span>
                <span>·</span>
                <span>冲突 {c.intensity ?? 1}</span>
                <button
                  onClick={() => {
                    setEditingId(c.id)
                    setEVal(c.emotion ?? 0)
                    setIVal(c.intensity ?? 1)
                  }}
                  className="ml-auto text-xs text-accent-periwinkle hover:underline"
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
        className="w-full max-w-md rounded cyber-modal p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold font-cute neon-text">修改情绪标注</h3>
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
          <label className="mb-1 block text-xs text-ink-500">冲突强度：{i}（1~5）</label>
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
            className="rounded border border-ink-300 px-4 py-1.5 text-sm hover:bg-ink-200/50"
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
            className="rounded cyber-btn px-4 py-1.5 text-sm disabled:opacity-50"
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
