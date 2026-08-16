import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCardStore } from '@/stores/cardStore'
import { useSortStore } from '@/stores/sortStore'
import { StructureNodesEditor } from '@/components/StructureNodesEditor'
import { CardThumb } from '@/components/CardThumb'
import { EmotionCurve } from '@/components/EmotionCurve'
import { computeChapterStats } from '@/engine/skeletonGen'
import type { Chapter } from '@/types'

// 章节卡片视图所需字段
interface ChapterCardData {
  id: string
  title?: string
  content: string
  emotion?: number
  intensity?: number
  isForeshadow?: boolean
  foreshadowResolved?: boolean
}

export function OutlinePage() {
  const navigate = useNavigate()
  const { cards: rawCards, loadAll } = useCardStore()
  const {
    sortedCards,
    runSort,
    runSkeletonDirections,
    skeletonDirections,
    selectedDirectionIdx,
    selectDirection,
    getNodes,
    getActiveTemplate,
    applyChaptersFromDirection,
    chapters,
    saveChapter,
    runEmotionRetag,
    emotionSeries,
    loadPersisted,
  } = useSortStore()

  const [loading, setLoading] = useState(true)
  const [perNode, setPerNode] = useState(2) // 每个节点默认 2 章
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftConflict, setDraftConflict] = useState('')
  const [viewingChapter, setViewingChapter] = useState<Chapter | null>(null)

  useEffect(() => {
    ;(async () => {
      await loadAll()
      await loadPersisted()
      if (sortedCards.length === 0) await runSort()
      if (emotionSeries.length === 0) await runEmotionRetag()
      if (skeletonDirections.length === 0) await runSkeletonDirections()
      if (chapters.length === 0 && skeletonDirections.length > 0) {
        await applyChaptersFromDirection(perNode)
      }
    })().finally(() => setLoading(false))
    // eslint-disable-next-line
  }, [])

  const activeDir = skeletonDirections[selectedDirectionIdx]
  const activeNodes = getNodes()
  const activeTpl = getActiveTemplate()

  const chapterByNode = useMemo(() => {
    const map: Record<string, Chapter[]> = {}
    activeNodes.forEach((n) => (map[n] = []))
    chapters.forEach((ch) => {
      if (!map[ch.nodeId]) map[ch.nodeId] = []
      map[ch.nodeId].push(ch)
    })
    return map
  }, [chapters, activeNodes])

  const totalCardCount = sortedCards.length || rawCards.length
  const emotionVals = emotionSeries.map((p) => p.y)
  const emotionXL = emotionSeries.map((p) => `#${p.x + 1}`)
  const conflictVals = emotionSeries.map((p) => {
    const card = sortedCards.find((c) => c.id === p.cardId)
    return card?.intensity ?? 1
  })
  const ideal = activeTpl?.idealEmotion ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">阶段三 · 骨架 & 章节</h1>
          <p className="text-xs text-ink-400">
            用结构模板构建故事骨架，生成章节规划，每章自动分配冲突卡片
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/sort')}
            className="rounded border border-ink-200 px-3 py-1.5 text-sm hover:bg-ink-50"
          >
            ← 返回阶段二
          </button>
          <button
            onClick={() => navigate('/export')}
            disabled={chapters.length === 0}
            className="rounded bg-ink-800 px-4 py-1.5 text-sm text-white hover:bg-ink-700 disabled:opacity-40"
          >
            导出大纲 →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse rounded border border-ink-100 p-8 text-center text-sm text-ink-400">
          正在加载骨架与结构…
        </div>
      ) : (
        <div className="space-y-5">
          {/* 方向（模板）选择 */}
          <section className="rounded border border-ink-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-800">① 骨架方向（按模板自动分界）</h2>
              <button
                onClick={() => runSkeletonDirections()}
                className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50"
              >
                ↻ 重新生成方向
              </button>
            </div>
            {skeletonDirections.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-400">
                请先在阶段一添加灵感卡片，再生成骨架方向
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {skeletonDirections.map((d, i) => {
                    const tplName =
                      d.templateName?.includes('·') && d.templateId
                        ? d.templateId
                        : d.templateName
                    return (
                      <button
                        key={i}
                        onClick={() => selectDirection(i)}
                        className={
                          'rounded border px-3 py-1.5 text-left text-xs transition ' +
                          (i === selectedDirectionIdx
                            ? 'border-ink-800 bg-ink-800 text-white'
                            : 'border-ink-200 hover:border-ink-400')
                        }
                      >
                        <div className="font-medium">方案 {i + 1}：{tplName}</div>
                        <div
                          className={
                            'mt-0.5 ' +
                            (i === selectedDirectionIdx ? 'text-white/70' : 'text-ink-500')
                          }
                        >
                          节点比例：
                          {d.nodeRatios.map((r) => `${Math.round(r * 100)}%`).join(':')}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {activeDir && (
                  <div className="grid grid-cols-1 gap-2 rounded bg-ink-50 p-3 sm:grid-cols-4">
                    {activeNodes.map((n, idx) => {
                      const from = idx === 0 ? 0 : activeDir.boundaries[idx - 1] ?? 0
                      const to = activeDir.boundaries[idx] ?? totalCardCount
                      const count = to - from
                      return (
                        <div
                          key={idx}
                          className="rounded border border-ink-200 bg-white p-2 text-xs"
                        >
                          <div className="mb-1 font-semibold">{n}</div>
                          <div className="text-ink-500">
                            卡片 #{from + 1} ~ #{Math.max(to, from)}（{count} 张）
                          </div>
                          <div className="mt-1 text-ink-400">
                            占比 {Math.round((activeDir.nodeRatios[idx] ?? 0) * 100)}%
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 结构节点编辑器（可改名/加/删） */}
          <section className="rounded border border-ink-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink-800">
              ② 结构节点（可改名/增删，对应起承转合等）
            </h2>
            <StructureNodesEditor
              nodes={activeNodes}
              totalCards={totalCardCount}
              boundaries={activeDir?.boundaries}
              onChange={(next) => {
                // 替换 nodes：直接通过 setter 操作 store 的 nodes
                // 由于 nodes setter 不是 action，通过逐个删加的方式不优雅；这里走「重写 nodes」
                // 我们在 sortStore 提供了 addNode/renameNode/removeNode 但不提供直接替换
                // 为了避免额外操作，这里直接对 state 做 patch 方式：先全部 remove 再按序 add 不可行
                // 简单做法：调用 setNodes 作为 action 加一个
                patchNodes(next)
              }}
              addLabel="自定义结构节点名，如 破镜 重逢 高虐 HE …"
            />
            <p className="mt-2 text-[10px] text-ink-400">
              说明：节点名修改后不会影响卡片分界（分界来自骨架方向的分配比例）。若要调整分界，重新选择或生成新方向。
            </p>
          </section>

          {/* 情绪曲线（含理想曲线对比） */}
          <section className="rounded border border-ink-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink-800">
                ③ 情绪冲突曲线：情绪值 + 冲突强度
              </h2>
              <button
                onClick={() => runEmotionRetag()}
                className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50"
              >
                ↻ 重新打情绪标
              </button>
            </div>
            {emotionVals.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-400">暂无标注数据</p>
            ) : (
              <EmotionCurve
                xLabels={emotionXL}
                values={emotionVals}
                conflictValues={conflictVals}
                idealCurve={
                  ideal.length
                    ? // 将理想曲线按节点长度扩展到 xLabels 长度
                      interpolate(ideal, emotionVals.length)
                    : undefined
                }
                height={300}
              />
            )}
          </section>

          {/* 生成章节 */}
          <section className="rounded border border-ink-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink-800 mr-auto">
                ④ 章节规划（每个节点生成 N 章）
              </h2>
              <label className="flex items-center gap-1 text-xs text-ink-500">
                每节点章节数：
                <select
                  value={perNode}
                  onChange={(e) => setPerNode(parseInt(e.target.value))}
                  className="rounded border border-ink-200 px-1.5 py-0.5 text-xs"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => applyChaptersFromDirection(perNode)}
                className="rounded border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50"
              >
                按方向重新生成章节
              </button>
              <span className="text-xs text-ink-400">共 {chapters.length} 章</span>
            </div>

            {chapters.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-400">
                先选择/生成骨架方向，然后点击「按方向重新生成章节」
              </p>
            ) : (
              <div className="space-y-5">
                {activeNodes.map((nodeName) => {
                  const list = chapterByNode[nodeName] ?? []
                  return (
                    <div key={nodeName}>
                      <div className="mb-2 flex items-center gap-2 border-b border-ink-100 pb-1">
                        <span className="rounded bg-ink-800 px-2 py-0.5 text-xs text-white">
                          {nodeName}
                        </span>
                        <span className="text-xs text-ink-400">{list.length} 章</span>
                      </div>
                      {list.length === 0 ? (
                        <p className="py-3 text-xs text-ink-400">暂无章节</p>
                      ) : (
                        <div className="space-y-3">
                          {list.map((ch) => (
                            <ChapterCard
                              key={ch.id}
                              chapter={ch}
                              sortedCards={sortedCards as ChapterCardData[]}
                              onEdit={() => {
                                setEditingChapter(ch)
                                setDraftTitle(ch.title)
                                setDraftConflict(ch.conflict)
                              }}
                              onViewEmotion={() => setViewingChapter(ch)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {editingChapter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingChapter(null)}
        >
          <div
            className="w-full max-w-lg rounded bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold">
              编辑章节 · 第 {editingChapter.index + 1} 章 · {editingChapter.nodeId}
            </h3>
            <label className="mb-1 block text-xs text-ink-500">章节标题</label>
            <input
              className="mb-3 w-full rounded border border-ink-200 px-2 py-1.5 text-sm"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
            <label className="mb-1 block text-xs text-ink-500">章节核心冲突（一句话）</label>
            <textarea
              className="mb-4 h-24 w-full rounded border border-ink-200 p-2 text-sm"
              value={draftConflict}
              onChange={(e) => setDraftConflict(e.target.value)}
            />
            <div className="mb-3 text-xs text-ink-400">
              已分配卡片：{editingChapter.cardIds.length} 张（卡片无法在此处编辑，调整章节请重新生成）
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingChapter(null)}
                className="rounded border border-ink-200 px-4 py-1.5 text-sm hover:bg-ink-50"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  await saveChapter(editingChapter.id, {
                    title: draftTitle,
                    conflict: draftConflict,
                  })
                  setEditingChapter(null)
                }}
                className="rounded bg-ink-800 px-4 py-1.5 text-sm text-white hover:bg-ink-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingChapter && (
        <ChapterEmotionForeshadowModal
          chapter={viewingChapter}
          sortedCards={sortedCards as ChapterCardData[]}
          onClose={() => setViewingChapter(null)}
        />
      )}
    </div>
  )
}

function patchNodes(next: string[]) {
  // 在 zustand 外部直接 set 不方便，我们通过 sortStore 的 setState 接口
  const anyStore = useSortStore as any
  const set = anyStore.setState as (p: any, replace?: boolean) => void
  set({ nodes: next })
}

function ChapterCard({
  chapter,
  sortedCards,
  onEdit,
  onViewEmotion,
}: {
  chapter: Chapter
  sortedCards: ChapterCardData[]
  onEdit: () => void
  onViewEmotion: () => void
}) {
  const cards = chapter.cardIds
    .map((id) => sortedCards.find((c) => c.id === id))
    .filter(Boolean) as ChapterCardData[]
  const foreshadowCount = cards.filter((c) => c.isForeshadow).length
  return (
    <div className="rounded border border-ink-200 bg-ink-50/40 p-3">
      <div className="mb-2 flex items-start gap-3">
        <div className="mt-0.5 text-xs font-semibold text-ink-500">
          第 {chapter.index + 1} 章
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">{chapter.title}</div>
          <div className="mt-0.5 text-xs text-ink-500">{chapter.conflict}</div>
        </div>
        <button
          onClick={onViewEmotion}
          className="rounded border border-ink-200 px-2 py-0.5 text-xs hover:bg-ink-50"
          title="查看本章情绪起伏与伏笔标注"
        >
          📊 情绪/伏笔
        </button>
        <button
          onClick={onEdit}
          className="rounded border border-ink-200 px-2 py-0.5 text-xs hover:bg-ink-50"
        >
          编辑
        </button>
      </div>
      {cards.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {cards.map((c) => (
            <CardThumb key={c.id} card={c as any} />
          ))}
        </div>
      )}
      {foreshadowCount > 0 && (
        <div className="mt-2 text-xs text-purple-600">🔖 本章含 {foreshadowCount} 条伏笔标注</div>
      )}
    </div>
  )
}

function ChapterEmotionForeshadowModal({
  chapter,
  sortedCards,
  onClose,
}: {
  chapter: Chapter
  sortedCards: ChapterCardData[]
  onClose: () => void
}) {
  const cards = chapter.cardIds
    .map((id) => sortedCards.find((c) => c.id === id))
    .filter(Boolean) as ChapterCardData[]

  const stats = computeChapterStats(cards)
  const xLabels = cards.map((c, i) => c.title?.trim() || `卡${i + 1}`)
  const { avgEmotion, maxEmotion, minEmotion, foreshadowCards, unresolvedForeshadowCount: unresolvedCount } = stats

  return (
    <div
      data-testid="chapter-emotion-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            📊 第 {chapter.index + 1} 章 · 情绪起伏与伏笔标注
          </h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            ×
          </button>
        </div>

        <div className="mb-2 text-xs text-ink-500">
          章节标题：{chapter.title} · 所属节点：{chapter.nodeId} · 含 {cards.length} 张卡片
        </div>

        {cards.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">本章暂无卡片</p>
        ) : (
          <>
            {/* 情绪统计概览 */}
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded border border-ink-200 bg-ink-50 p-2">
                <div className="text-ink-400">平均情绪</div>
                <div className="text-base font-semibold text-ink-800">{avgEmotion}</div>
              </div>
              <div className="rounded border border-green-200 bg-green-50 p-2">
                <div className="text-ink-400">最高情绪</div>
                <div className="text-base font-semibold text-green-700">+{maxEmotion}</div>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-2">
                <div className="text-ink-400">最低情绪</div>
                <div className="text-base font-semibold text-red-700">{minEmotion}</div>
              </div>
            </div>

            {/* 情绪曲线 */}
            <div className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-ink-700">情绪起伏曲线</h4>
              <EmotionCurve xLabels={xLabels} values={stats.emotions} conflictValues={stats.intensities} height={240} />
            </div>

            {/* 伏笔标注 */}
            <div className="mb-2">
              <div className="mb-2 flex items-center gap-2">
                <h4 className="text-sm font-semibold text-ink-700">🔖 伏笔标注</h4>
                {foreshadowCards.length > 0 && (
                  <span className="text-xs text-ink-500">
                    共 {foreshadowCards.length} 条
                    {unresolvedCount > 0 && (
                      <span className="ml-1 text-red-500">⚠ {unresolvedCount} 条未回收</span>
                    )}
                  </span>
                )}
              </div>
              {foreshadowCards.length === 0 ? (
                <p className="rounded border border-dashed border-ink-200 p-4 text-center text-xs text-ink-400">
                  本章无伏笔标注
                </p>
              ) : (
                <ul className="space-y-2">
                  {foreshadowCards.map((c) => {
                    const resolved = c.resolved
                    return (
                      <li
                        key={c.id}
                        className={
                          'rounded border p-2 text-xs ' +
                          (resolved ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50')
                        }
                      >
                        <div className="flex items-center gap-2">
                          {!resolved && <span className="text-red-500">⚠️</span>}
                          <span className="font-medium text-ink-800">{c.title}</span>
                          <span
                            className={
                              'ml-auto rounded px-1.5 py-0.5 text-[10px] ' +
                              (resolved
                                ? 'bg-green-200 text-green-800'
                                : 'bg-red-200 text-red-800')
                            }
                          >
                            {resolved ? '已回收' : '未回收'}
                          </span>
                        </div>
                        {c.content && (
                          <p className="mt-1 line-clamp-2 text-ink-600">{c.content}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* 卡片情绪明细 */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-ink-700">卡片情绪明细</h4>
              <ul className="space-y-1">
                {cards.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 rounded bg-ink-50 p-1.5 text-xs">
                    <span className="text-ink-400">#{i + 1}</span>
                    <span className="flex-1 truncate text-ink-700">
                      {c.title?.trim() || '（无标题）'}
                    </span>
                    {c.isForeshadow && <span className="text-purple-600">🔖</span>}
                    <span
                      className={
                        'rounded px-1.5 py-0.5 text-[10px] ' +
                        ((c.emotion ?? 0) >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700')
                      }
                    >
                      情绪 {c.emotion ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded border border-ink-200 px-4 py-1.5 text-sm hover:bg-ink-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// 插值：把 short 数组插值到 length 长度
function interpolate(short: number[], length: number): number[] {
  if (length <= 0 || short.length === 0) return []
  if (short.length === 1) return Array.from({ length }, () => short[0])
  const result: number[] = []
  const step = (short.length - 1) / (length - 1 || 1)
  for (let i = 0; i < length; i++) {
    const pos = i * step
    const lo = Math.floor(pos)
    const hi = Math.min(short.length - 1, lo + 1)
    const t = pos - lo
    result.push(short[lo] * (1 - t) + short[hi] * t)
  }
  return result
}
