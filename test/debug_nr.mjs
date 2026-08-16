// narrative 调试
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '_engine_js')
const nr = await import('file:///' + resolve(outDir, 'engine/narrativeLine.js').replace(/\\/g, '/'))

function mkCard(id, content, overrides = {}) {
  return {
    id,
    content,
    createdAt: overrides.createdAt ?? Date.now() - parseInt(id.replace(/\D/g, '') || '0') * 60000,
    updatedAt: Date.now(),
    stage: overrides.stage ?? 'none',
    emotion: 0,
    intensity: 1,
    ...overrides,
  }
}
const late = mkCard('c100', '结局', { stage: 'post' })
const mid = mkCard('c50', '中段内容', { stage: 'mid' })
const early = mkCard('c10', '初次相遇', { stage: 'pre' })
console.log('late:', late)
console.log('early:', early)
const res = nr.sortNarrativeLine([late, mid, early])
console.log('ordered IDs:', res.cards.map(c => c.id))
console.log('gaps:', res.gaps)
// 手动算分数
const stageWeight = { pre: 0, mid: 0.5, post: 1, none: 0.3 }
const earlyKws = ['开始','初见','初遇','小时候','从前','出生','相遇','初识','第一次','回忆','前世','重生前']
const lateKws = ['结局','最后','终章','多年后','结局','尾声','落幕','老去','死去','临死','终于','最后']
for (const c of [early, mid, late]) {
  let kw = 0
  for (const k of earlyKws) if (c.content.includes(k)) kw -= 0.2
  for (const k of lateKws) if (c.content.includes(k)) kw += 0.2
  const tsMin = Math.min(...[early, mid, late].map(x => x.createdAt))
  const tsMax = Math.max(...[early, mid, late].map(x => x.createdAt))
  const tsRange = tsMax === tsMin ? 1 : tsMax - tsMin
  const ts = (c.createdAt - tsMin) / tsRange
  const stage = stageWeight[c.stage] ?? 0.3
  const score = stage + kw * 0.3 + ts * 0.3 + (c.order ? (c.order / 10000) : 0)
  console.log(c.id, 'stage:', stage, 'kw:', kw, 'ts:', ts, 'score:', score)
}
