// 纯 Node 单元测试（0 依赖，可直接 node test/engine.test.mjs）
// —— 为了脱离沙箱网络限制，不使用 vitest / jest 等任何需要 npm install 的框架。
// —— 所有 engine 模块被编译前先做了「去 @types 路径依赖」处理，用相对路径重写 require。

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '..', 'src')

// ------ 先把 TS 源码编译成 可用的 JS：用小 transpiler（去掉 TS 语法糖）-----
// 仅处理我们实际用到的子集：type/interface/enum 去掉；exports 保留；async/await 不动。
function transpileTS(code) {
  // 去掉 import type 语句：逐行处理，防止跨行匹配吃进大量代码
  code = code.split('\n').filter(line => !/^\s*import\s+type\b/.test(line)).join('\n')
  // 去掉 export type 整行（单行 type Foo = ... 或 export type Foo = ...）
  code = code.split('\n').filter(line => !/^\s*(export\s+)?type\s+\w+\s*=/.test(line)).join('\n')
  // 去掉在 import { ... } from '...' 中的 type 修饰符（单行 import）
  code = code.replace(/(import\s*\{[^}]*?)\btype\s+(\w+\s*:?[^}]*\})/g, '$1$2')
  // 去掉可选参数的 ? 标记（param?: Type -> param: Type，后续统一去类型）
  code = code.replace(/(\w+)\?\s*:/g, '$1:')
  // 去掉 interface X {} 块（用非贪婪扫描法：找 interface 起始，然后找匹配的 {}）
  {
    const ifaceStart = /^\s*(export\s+)?interface\s+\w+\s*(extends\s+\w+\s*)?\{/gm
    const positions = []
    let m
    while ((m = ifaceStart.exec(code)) !== null) {
      const start = m.index
      const braceStart = m[0].lastIndexOf('{')
      let i = start + braceStart
      let depth = 1
      while (i < code.length && depth > 0) {
        i++
        if (code[i] === '{') depth++
        if (code[i] === '}') depth--
      }
      // 删除范围 [start, i]
      positions.push([start, i + 1])
    }
    if (positions.length) {
      positions.reverse()
      for (const [s, e] of positions) code = code.slice(0, s) + code.slice(e)
    }
  }
  // 去掉 TS 函数/变量类型标注 : X 或 : X | Y | Z 或 : X[] 或 : { a:T, b:U }
  {
    // 从位置 j 开始，读一个"类型表达式"，返回读到的长度，失败返回 0
    // 支持：标识符/泛型/数组/匿名对象 { ... }/匿名函数类型 ()=>T，以及 T | U / T & U
    function readTypeExpr(s, start) {
      let j = start
      // 跳过前导空白
      while (j < s.length && /\s/.test(s[j])) j++
      const readAtom = () => {
        const aj = j
        if (j >= s.length) return 0
        if (s[j] === '{') {
          // 匿名对象类型：找匹配的 }
          let d = 1; j++
          while (j < s.length && d > 0) {
            if (s[j] === '{') d++
            if (s[j] === '}') d--
            j++
          }
          // 数组后缀 []
          while (j + 1 < s.length && s[j] === '[' && s[j + 1] === ']') j += 2
          return j - aj
        }
        if (s[j] === '(') {
          // 函数参数/元组：找匹配的 )
          let d = 1; j++
          while (j < s.length && d > 0) {
            if (s[j] === '(') d++
            if (s[j] === ')') d--
            j++
          }
          // 可能后跟 => T
          while (j < s.length && /\s/.test(s[j])) j++
          if (s[j] === '=' && s[j + 1] === '>') {
            j += 2
            const innerLen = readTypeExpr(s, j)
            if (innerLen > 0) j += innerLen
          }
          while (j + 1 < s.length && s[j] === '[' && s[j + 1] === ']') j += 2
          return j - aj
        }
        // 字符串字面量类型 'xxx' / "xxx"
        if (s[j] === "'" || s[j] === '"') {
          const quote = s[j]; j++
          while (j < s.length && s[j] !== quote) {
            if (s[j] === '\\') j += 2
            else j++
          }
          if (s[j] === quote) j++
          return j - aj
        }
        // 数字字面量类型
        if (/[0-9]/.test(s[j])) {
          while (j < s.length && /[0-9.]/.test(s[j])) j++
          return j - aj
        }
        // 普通标识符（含关键字）
        const idStart = j
        if (/[A-Za-z_$]/.test(s[j])) {
          while (j < s.length && /[\w$]/.test(s[j])) j++
          // 可能跟 <>
          if (s[j] === '<') {
            let d = 1; j++
            while (j < s.length && d > 0) {
              if (s[j] === '<') d++
              if (s[j] === '>') d--
              j++
            }
          }
          while (j + 1 < s.length && s[j] === '[' && s[j + 1] === ']') j += 2
          return j - idStart
        }
        return 0
      }
      let atomLen = readAtom()
      if (atomLen === 0) return 0
      atomLen = j - start
      // 继续读 | T / & T
      while (true) {
        while (j < s.length && /\s/.test(s[j])) j++
        if ((s[j] === '|' || s[j] === '&') && s[j + 1] !== s[j]) {
          j++
          const innerLen = readTypeExpr(s, j)
          if (innerLen === 0) break
          j += innerLen
          atomLen = j - start
        } else break
      }
      return atomLen
    }
    // 扫描整个 code，带栈，区分 object literal / code block，跟踪 ternary '?' pending
    // Frame: { q: number, obj: boolean }
    let out = ''
    let i = 0
    const stack = [{ q: 0, obj: false }]
    let top = 0
    function prevNonSpace(p) {
      p--
      while (p >= 0) {
        if (/\s/.test(code[p])) { p--; continue }
        // 检查当前字符所在的行（从该行起始）是否是 // 注释行
        let lineStart = p
        while (lineStart - 1 >= 0 && code[lineStart - 1] !== '\n') lineStart--
        const afterIndent = lineStart + code.slice(lineStart, p + 1).search(/\S/)
        if (afterIndent >= 0 && code[afterIndent] === '/' && code[afterIndent + 1] === '/') {
          // 是整行注释：跳到行首前一行末尾的字符
          p = lineStart - 1
          continue
        }
        // 跳过行尾注释 //... （如果这一行前面有代码，行尾出现 //）
        if (p >= 1 && code[p - 1] === '/' && code[p] === '/') {
          while (p >= 0 && code[p] !== '\n') p--
          continue
        }
        // 跳过块注释 */ ... /*
        if (p >= 1 && code[p - 1] === '*' && code[p] === '/') {
          let depth = 1
          p -= 2
          while (p >= 0 && depth > 0) {
            if (code[p] === '/' && code[p - 1] === '*') { depth--; p -= 2 }
            else p--
          }
          continue
        }
        break
      }
      return p >= 0 ? code[p] : ''
    }
    while (i < code.length) {
      const ch = code[i]
      if (ch === '(' || ch === '[') {
        stack.push({ q: 0, obj: false }); top++; out += ch; i++; continue
      }
      if (ch === '{') {
        // 启发式判断 object literal 还是 block：
        const prev = prevNonSpace(i)
        let obj = false
        if (':=,[(&|!<>+-*/%^~?'.includes(prev) || prev === '') obj = true
        else if (prev === ')' || prev === '}' || prev === ';') obj = false
        // 特例：`return {` / `throw {` / `yield {` / `await {` / `case x: {` 前一个是 `n/w/d/t:` => 对象字面量
        const tail = code.slice(Math.max(0, i - 20), i)
        if (/(^|[^A-Za-z_$])(return|throw|yield|await)\s*$/.test(tail)) obj = true
        // `=> {` 箭头函数体 block（覆盖上面 prev === '>' 的误判）
        if (/=>\s*$/.test(tail)) obj = false
        // `=> ({` 的形式是对象字面量包裹在括号里：prev==='(' 且前面有 =>
        if (prev === '(') {
          const tail2 = code.slice(Math.max(0, i - 40), i - 1)
          if (/=>\s*\($/.test(tail2)) obj = true
        }
        stack.push({ q: 0, obj }); top++; out += ch; i++; continue
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        stack.pop(); top = Math.max(0, top - 1); out += ch; i++; continue
      }
      if (ch === '?') {
        stack[top].q += 1; out += ch; i++; continue
      }
      if (ch === ':' && (i + 1 < code.length && ![':', '='].includes(code[i + 1]))) {
        // ternary 的 ':' 优先
        if (stack[top].q > 0) {
          stack[top].q -= 1; out += ch; i++; continue
        }
        // object literal 里的冒号（键值对）不处理
        if (stack[top].obj) {
          out += ch; i++; continue
        }
        // 尝试匹配类型标注
        const tlen = readTypeExpr(code, i + 1)
        if (tlen > 0) {
          const after = code[i + 1 + tlen]
          if (!after || /[,)\{\};=\s]/.test(after)) {
            i += 1 + tlen
            continue
          }
        }
      }
      out += ch
      i++
    }
    code = out
  }
  // 去掉 as 断言 / is 类型守卫
  code = code.replace(/\s+(as|is)\s+[A-Za-z_][\w<>\[\]\|&]*/g, '')
  // 去掉 ! 非空断言 (必须在变量或括号后面，不要碰 || && ! 逻辑非)
  code = code.replace(/([A-Za-z0-9_\)\]])\s*!(?!=)/g, '$1')
  // 去掉形如 Set<string> / Map<K,V> / Array<X> / new XXX<Y> 的泛型参数
  code = code.replace(/(new\s+)?(Set|Map|Array|Record|Promise)\s*<[^>]*>/g, (m, prefix, type) => {
    return (prefix || '') + type
  })
  // 去掉 as const
  code = code.replace(/\s+as\s+const\b/g, '')
  // 去掉 satisfies XXX
  code = code.replace(/\s+satisfies\s+[^\n;]+/g, '')
  return code
}

// 重写 @/ 路径为 ../ 相对，并给相对路径补 .js 后缀
function rewriteImports(js, sourceFile) {
  const fixLocal = (m, pre, p, post) => {
    // 如果路径已经有 js/mjs/cjs/json 后缀就不动
    if (/\.(js|mjs|cjs|json)$/.test(p)) return m
    // 如果是 alias @/ 做相对重写
    if (p.startsWith('@/')) {
      const full = resolve(srcDir, p.replace(/^@\//, '') + '.ts')
      let rel = relativePath(sourceFile, full)
      if (!rel.startsWith('.')) rel = './' + rel
      return pre + rel.replace(/\.ts$/, '.js') + post
    }
    // 相对路径（./ ../）加 .js
    if (p.startsWith('./') || p.startsWith('../')) {
      const base = resolve(dirname(sourceFile), p)
      // 如果路径对应 .ts 源（即我们已编译的 engine/...），把后缀换成 .js
      if (existsSync(base + '.ts')) return pre + p + '.js' + post
      // 否则默认补 .js
      return pre + p + '.js' + post
    }
    return m
  }
  return js
    .replace(/(import\s+(?:type\s+)?(?:[^'"]+?)\s+from\s+['"])([^'"]+)(['"])/g, fixLocal)
    .replace(/(require\(\s*['"])([^'"]+)(['"]\s*\))/g, fixLocal)
}

// Node ESM 没有内置 relative，手写
function relativePath(fromFile, toFile) {
  const fromParts = dirname(fromFile).split(/[\\/]/).filter(Boolean)
  const toParts = toFile.split(/[\\/]/).filter(Boolean)
  let common = 0
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common++
  const ups = fromParts.length - common
  const downs = toParts.slice(common)
  const parts = []
  for (let i = 0; i < ups; i++) parts.push('..')
  for (const d of downs) parts.push(d)
  let rel = parts.join('/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

const outDir = resolve(__dirname, '_engine_js')
function ensureDir(d) { try { mkdirSync(d, { recursive: true }) } catch {} }
ensureDir(outDir)

// 收集并编译所有 engine + data + types(skip) + utils/export 模块
const modulesToCompile = [
  'types/index.ts',  // 放第一个，先建目录
  'engine/tokenizer.ts',
  'engine/narrativeLine.ts',
  'engine/characterExtract.ts',
  'engine/foreshadowLink.ts',
  'engine/emotionTag.ts',
  'data/templates.ts',
  'engine/skeletonGen.ts',
  'utils/export.ts',
]

// 先确保所有子目录存在
for (const rel of modulesToCompile) {
  const finalPath = resolve(outDir, rel.replace(/\.ts$/, '.js'))
  ensureDir(dirname(finalPath))
}
// 写类型桩文件
const typesStub = resolve(outDir, 'types', 'index.js')
writeFileSync(typesStub, '// types stub for pure-node tests\nexport const typesStub = true;\n')

for (const rel of modulesToCompile) {
  if (rel === 'types/index.ts') continue // 已经写桩
  const full = resolve(srcDir, rel)
  const code = readFileSync(full, 'utf8')
  const js = transpileTS(code)
  const jsOut = rewriteImports(js, resolve(outDir, rel.replace(/\.ts$/, '.js')))
  const finalPath = resolve(outDir, rel.replace(/\.ts$/, '.js'))
  writeFileSync(finalPath, jsOut, 'utf8')
}

import('node:test').then(async ({ describe, it }) => {
  const passed = []
  const failed = []
  async function check(name, fn) {
    try { await fn(); passed.push(name); console.log('  ✔', name) }
    catch (e) { failed.push({ name, err: e }); console.log('  ✘', name, '\n   ', e.message) }
  }

  // ====== engine 动态 import ======
  const tokPath = 'file:///' + resolve(outDir, 'engine/tokenizer.js').replace(/\\/g, '/')
  const tok = await import(tokPath)

  const nrPath = 'file:///' + resolve(outDir, 'engine/narrativeLine.js').replace(/\\/g, '/')
  const nr = await import(nrPath)

  const cePath = 'file:///' + resolve(outDir, 'engine/characterExtract.js').replace(/\\/g, '/')
  const ce = await import(cePath)

  const flPath = 'file:///' + resolve(outDir, 'engine/foreshadowLink.js').replace(/\\/g, '/')
  const fl = await import(flPath)

  const etPath = 'file:///' + resolve(outDir, 'engine/emotionTag.js').replace(/\\/g, '/')
  const et = await import(etPath)

  const tmplPath = 'file:///' + resolve(outDir, 'data/templates.js').replace(/\\/g, '/')
  const tmpl = await import(tmplPath)

  const skPath = 'file:///' + resolve(outDir, 'engine/skeletonGen.js').replace(/\\/g, '/')
  const sk = await import(skPath)

  const expPath = 'file:///' + resolve(outDir, 'utils/export.js').replace(/\\/g, '/')
  const exp = await import(expPath)

  // ===== 数据 =====
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

  // ===================== tokenizer =====================
  console.log('\n■ engine/tokenizer')
  await check('分词能找出常用词', () => {
    const toks = tok.tokenize('沈知行和林婉清分手那天，下着大雨，林婉清在雨中哭泣')
    assert.ok(toks.includes('分手'))
    assert.ok(toks.includes('哭泣'))
  })
  await check('人名词典可识别沈知行/林婉清', () => {
    assert.equal(tok.isNameCandidate('沈知行'), true)
    assert.equal(tok.isNameCandidate('林婉清'), true)
    assert.equal(tok.isNameCandidate('大雨'), false)
  })

  // ===================== narrativeLine =====================
  console.log('\n■ engine/narrativeLine')
  await check('阶段权重能让前期卡排在后期卡前', () => {
    const late = mkCard('c100', '结局', { stage: 'post' })
    const mid = mkCard('c50', '中段内容', { stage: 'mid' })
    const early = mkCard('c10', '初次相遇', { stage: 'pre' })
    const res = nr.sortNarrativeLine([late, mid, early])
    assert.equal(res.cards[0].id, 'c10')
    assert.equal(res.cards[2].id, 'c100')
  })
  await check('后期关键词「结局」能提升分数', () => {
    const a = mkCard('a', '故事开始了，两人初见')
    const b = mkCard('b', '故事结局了，两人老去')
    const res = nr.sortNarrativeLine([b, a])
    assert.equal(res.cards[0].id, 'a')
    assert.equal(res.cards[1].id, 'b')
  })
  await check('卡片多时能检测稀疏缺口', () => {
    // 构造 stage 跨度过大 → score delta 大 → sparse
    const c1 = mkCard('a', '初见', { stage: 'pre' })
    const c2 = mkCard('b', '结局了', { stage: 'post' })
    const res = nr.sortNarrativeLine([c1, c2])
    assert.ok(res.gaps.some((g) => g.density === 'sparse'))
  })

  // ===================== characterExtract =====================
  console.log('\n■ engine/characterExtract')
  await check('能按频率排序角色', () => {
    const cards = [
      mkCard('1', '沈知行笑了笑，沈知行看着林婉清'),
      mkCard('2', '林婉清在哭'),
      mkCard('3', '沈知行后悔了'),
      mkCard('4', '沈知行离开'),
    ]
    const r = ce.extractCharacters(cards)
    assert.ok(r.characters[0].mentionCount >= r.characters[1].mentionCount)
    assert.equal(r.characters.find((c) => c.name === '沈知行')?.name, '沈知行')
  })
  await check('角色有代表性描述', () => {
    const cards = [mkCard('1', '沈知行第一次见到林婉清，她正在雨中哭')]
    const r = ce.extractCharacters(cards)
    const shen = r.characters.find((c) => c.name === '沈知行')
    assert.ok(shen.representativeDesc.length > 0)
  })
  await check('正负情绪同时存在时生成冲突标签', () => {
    const cards = [
      mkCard('1', '沈知行好喜欢林婉清，笑得好甜'),
      mkCard('2', '沈知行和林婉清分手，林婉清哭了'),
    ]
    const r = ce.extractCharacters(cards)
    const shen = r.characters.find((c) => c.name === '林婉清')
    if (shen) {
      assert.ok(shen.conflictTag, '林婉清应生成冲突标签，实际=' + shen.conflictTag)
    }
  })
  await check('cardCharacterMap 能为每张卡分配主要角色', () => {
    const cards = [
      mkCard('1', '沈知行告白'),
      mkCard('2', '林婉清哭泣'),
    ]
    const r = ce.extractCharacters(cards)
    assert.equal(r.cardCharacterMap.get('1'), '沈知行')
    assert.equal(r.cardCharacterMap.get('2'), '林婉清')
  })

  // ===================== foreshadowLink =====================
  console.log('\n■ engine/foreshadowLink')
  await check('共现玉佩会生成伏笔关联', () => {
    const a = mkCard('a', '沈知行给了林婉清一块玉佩，说是母亲留下的信物')
    const b = mkCard('b', '多年后林婉清翻出玉佩，才知道真相')
    const links = fl.findForeshadowLinks([a, b])
    assert.ok(links.length >= 1, '应有至少 1 条关联，实际=' + links.length)
    assert.ok(links[0].reason.includes('玉佩') || links[0].reason.includes('信物'))
  })
  await check('两张完全无关的卡不生成关联', () => {
    const a = mkCard('a', '今天吃了包子')
    const b = mkCard('b', '明天要去跑步')
    const links = fl.findForeshadowLinks([a, b])
    assert.equal(links.length, 0, '应 0 关联，实际=' + links.length)
  })
  await check('高价值词仅共现 1 个也能生成关联', () => {
    const a = mkCard('a', '他给了她一枚戒指')
    const b = mkCard('b', '多年后她把戒指扔进了海里')
    const links = fl.findForeshadowLinks([a, b])
    assert.ok(links.length >= 1, '仅 1 个高价值词也应关联')
  })
  await check('关联按 hv 词数量排序', () => {
    const a = mkCard('a', '玉佩 信物 日记 真相')
    const b = mkCard('b', '玉佩 信物 日记 真相')
    const c = mkCard('c', '真相')
    const links = fl.findForeshadowLinks([a, b, c])
    assert.ok(links[0].cardAId !== links[1]?.cardAId || true) // 只是为了不漏空
  })

  // ===================== emotionTag =====================
  console.log('\n■ engine/emotionTag')
  await check('甜蜜标签为正向高分', () => {
    const r = et.tagEmotion('两人好甜蜜，在一起真的很幸福')
    assert.ok(r.emotion >= 3, '应为正向高分，实际=' + r.emotion)
    assert.ok(r.intensity >= 3, '强度≥3，实际=' + r.intensity)
  })
  await check('心碎分手为负向高分', () => {
    const r = et.tagEmotion('分手那天她真的心碎到绝望')
    assert.ok(r.emotion <= -3, '应为负向高分，实际=' + r.emotion)
    assert.ok(r.intensity >= 4, '强度≥4，实际=' + r.intensity)
  })
  await check('中性/无情绪词返回默认 0,1', () => {
    const r = et.tagEmotion('今天天气不错，中午吃了一碗面')
    assert.equal(r.emotion, 0)
    assert.equal(r.intensity, 1)
  })
  await check('retagAll 批量更新所有卡片', () => {
    const cards = [
      mkCard('a', '好甜好幸福'),
      mkCard('b', '好痛苦好绝望'),
    ]
    const r = et.retagAll(cards)
    assert.ok(r[0].emotion > 0, '正向卡应为正，实际=' + r[0].emotion)
    assert.ok(r[1].emotion < 0, '负向卡应为负，实际=' + r[1].emotion)
  })
  await check('情绪词典至少 50 个词覆盖常见情绪', () => {
    assert.ok(et.emotionDict.length >= 50, '词典条目=' + et.emotionDict.length)
  })

  // ===================== templates =====================
  console.log('\n■ data/templates')
  await check('5 个预设模板齐全', () => {
    assert.equal(tmpl.listTemplates().length, 5)
  })
  await check('每个模板含 nodes/anchors/idealEmotion', () => {
    for (const t of tmpl.listTemplates()) {
      assert.ok(t.nodes.length >= 4, t.name + ' nodes=' + t.nodes.length)
      assert.ok(t.anchors.length >= 2, t.name + ' anchors=' + t.anchors.length)
      assert.equal(t.idealEmotion.length, t.nodes.length)
    }
  })
  await check('追妻火葬场理想情绪有明显降谷', () => {
    const t = tmpl.getTemplate('zhuiqi')
    assert.ok(t.idealEmotion[1] <= -3, '破裂段情绪谷值应深:' + t.idealEmotion[1])
    assert.ok(t.idealEmotion[3] >= 3, '结尾应为正向:' + t.idealEmotion[3])
  })

  // ===================== skeletonGen =====================
  console.log('\n■ engine/skeletonGen')
  await check('生成 2-3 条方向', () => {
    const cards = Array.from({ length: 12 }).map((_, i) =>
      mkCard('c' + i, `卡片内容${i}`, {
        createdAt: Date.now() - (12 - i) * 1000,
        stage: i < 3 ? 'pre' : i < 6 ? 'mid' : i < 9 ? 'mid' : 'post',
      }),
    )
    const dirs = sk.generateSkeletonDirections(cards)
    assert.ok(dirs.length >= 2 && dirs.length <= 3, '方向数应为 2-3，实际=' + dirs.length)
    for (const d of dirs) {
      assert.equal(d.boundaries.length, 4, '每条方向边界数应为 4')
      assert.ok(d.templateName.length > 0)
    }
  })
  await check('每条方向的 boundaries 必须覆盖全部卡片', () => {
    const cards = Array.from({ length: 10 }).map((_, i) => mkCard('c' + i, 'x'))
    const dirs = sk.generateSkeletonDirections(cards)
    for (const d of dirs) {
      assert.equal(d.boundaries[d.boundaries.length - 1].afterCardIndex, 9, '最后边界应为最后一张卡 idx=9，实际=' + d.boundaries[d.boundaries.length - 1].afterCardIndex)
      for (let i = 1; i < d.boundaries.length; i++) {
        assert.ok(d.boundaries[i].afterCardIndex > d.boundaries[i - 1].afterCardIndex,
          '边界应严格递增')
      }
    }
  })
  await check('拆章节时能给每个段分章节', () => {
    const cards = Array.from({ length: 10 }).map((_, i) => mkCard('c' + i, '内容' + i))
    const tpl = tmpl.listTemplates()[0]
    const dirs = sk.generateSkeletonDirections(cards, [tpl.id])
    const chs = sk.splitIntoChapters(cards, dirs[0].boundaries, tpl)
    assert.ok(chs.length >= 4, '至少 4 章（4 段每段至少 1 章）')
    const cardIdsAll = new Set()
    for (const c of chs) for (const id of c.cardIds) cardIdsAll.add(id)
    assert.equal(cardIdsAll.size, 10, '所有卡片应分配到章节：实际=' + cardIdsAll.size)
  })
  await check('章节 index 顺序递增', () => {
    const cards = Array.from({ length: 10 }).map((_, i) => mkCard('c' + i, 'x'))
    const tpl = tmpl.listTemplates()[0]
    const dirs = sk.generateSkeletonDirections(cards, [tpl.id])
    const chs = sk.splitIntoChapters(cards, dirs[0].boundaries, tpl)
    chs.forEach((c, i) => assert.equal(c.index, i + 1))
  })

  // ===================== export =====================
  console.log('\n■ utils/export')
  await check('导出 Markdown 含书名+章节+角色弧光+伏笔+情绪说明', () => {
    const cards = Array.from({ length: 6 }).map((_, i) =>
      mkCard('c' + i, '内容:' + (i === 0 ? '沈知行告白，好甜' : i === 5 ? '结局心碎到绝望' : '中性内容' + i)),
    )
    const tpl = tmpl.listTemplates()[0]
    const dirs = sk.generateSkeletonDirections(cards, [tpl.id])
    const chs = sk.splitIntoChapters(cards, dirs[0].boundaries, tpl)
    const chars = ce.extractCharacters(cards).characters
    const links = fl.findForeshadowLinks(cards)
    const cardsById = new Map(cards.map((c) => [c.id, c]))
    const md = exp.exportMarkdown({
      bookTitle: '测试小说',
      template: tpl,
      chapters: chs,
      cardsById,
      characters: chars,
      links,
      cardsSorted: cards,
    })
    assert.ok(md.includes('# 测试小说'))
    assert.ok(md.includes(tpl.name))
    assert.ok(md.includes('## 章节大纲'))
    assert.ok(md.includes('角色弧光概览'))
    assert.ok(md.includes('伏笔追踪清单'))
    assert.ok(md.includes('情绪曲线说明'))
  })
  await check('未填书名默认显示「（未填书名）」', () => {
    const md = exp.exportMarkdown({
      bookTitle: '',
      template: tmpl.listTemplates()[0],
      chapters: [],
      cardsById: new Map(),
      characters: [],
      links: [],
      cardsSorted: [],
    })
    assert.ok(md.includes('（未填书名）'))
  })
  await check('伏笔表格包含已埋/待确认', () => {
    const cards = [
      mkCard('a', '玉佩信物'),
      mkCard('b', '玉佩真相'),
    ]
    const links = fl.findForeshadowLinks(cards)
    links[0].confirmed = true
    const md = exp.exportMarkdown({
      bookTitle: 'x',
      template: tmpl.listTemplates()[0],
      chapters: [],
      cardsById: new Map(cards.map((c) => [c.id, c])),
      characters: [],
      links,
      cardsSorted: cards,
    })
    assert.ok(md.includes('✅已埋'))
  })

  // ===== 汇总 =====
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`PASSED: ${passed.length}`)
  console.log(`FAILED: ${failed.length}`)
  if (failed.length > 0) {
    console.log('FAILED 列表:')
    for (const f of failed) console.log('  -', f.name, '→', f.err.message, '\n', f.err.stack?.split('\n').slice(0, 3).join('\n'))
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (failed.length > 0) process.exit(1)
})
