import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '..', 'src')

function transpileTS(code) {
  code = code.split('\n').filter(line => !/^\s*import\s+type\b/.test(line)).join('\n')
  code = code.split('\n').filter(line => !/^\s*(export\s+)?type\s+\w+\s*=/.test(line)).join('\n')
  code = code.replace(/(import\s*\{[^}]*?)\btype\s+(\w+\s*:?[^}]*\})/g, '$1$2')
  // interface 剥离
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
      positions.push([start, i + 1])
    }
    positions.reverse()
    for (const [s, e] of positions) code = code.slice(0, s) + code.slice(e)
  }
  // 标注删除
  {
    function readTypeExpr(s, start) {
      let j = start
      while (j < s.length && /\s/.test(s[j])) j++
      const readAtom = () => {
        const aj = j
        if (j >= s.length) return 0
        if (s[j] === '{') {
          let d = 1; j++
          while (j < s.length && d > 0) {
            if (s[j] === '{') d++
            if (s[j] === '}') d--
            j++
          }
          while (j + 1 < s.length && s[j] === '[' && s[j + 1] === ']') j += 2
          return j - aj
        }
        if (s[j] === '(') {
          let d = 1; j++
          while (j < s.length && d > 0) {
            if (s[j] === '(') d++
            if (s[j] === ')') d--
            j++
          }
          while (j < s.length && /\s/.test(s[j])) j++
          if (s[j] === '=' && s[j + 1] === '>') {
            j += 2
            const innerLen = readTypeExpr(s, j)
            if (innerLen > 0) j += innerLen
          }
          while (j + 1 < s.length && s[j] === '[' && s[j + 1] === ']') j += 2
          return j - aj
        }
        if (s[j] === "'" || s[j] === '"') {
          const q = s[j]; j++
          while (j < s.length && s[j] !== q) {
            if (s[j] === '\\') j += 2
            else j++
          }
          if (s[j] === q) j++
          return j - aj
        }
        if (/[0-9]/.test(s[j])) {
          while (j < s.length && /[0-9.]/.test(s[j])) j++
          return j - aj
        }
        const idStart = j
        if (/[A-Za-z_$]/.test(s[j])) {
          while (j < s.length && /[\w$]/.test(s[j])) j++
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
    function prevNonSpace(code, p) {
      p--
      while (p >= 0) {
        if (/\s/.test(code[p])) { p--; continue }
        if (p >= 1 && code[p - 1] === '/' && code[p] === '/') {
          while (p >= 0 && code[p] !== '\n') p--
          continue
        }
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
    const log = []
    let out = ''
    let i = 0
    const stack = [{ q: 0, obj: false, tag: 'top' }]
    let top = 0
    while (i < code.length) {
      const ch = code[i]
      if (ch === '(' || ch === '[') {
        stack.push({ q: 0, obj: false, tag: ch + '@' + i }); top++; out += ch; i++; continue
      }
      if (ch === '{') {
        const prev = prevNonSpace(code, i)
        let obj = false
        if (':=,[(&|!<>+-*/%^~?'.includes(prev) || prev === '') obj = true
        else if (prev === ')' || prev === '}' || prev === ';') obj = false
        const tail = code.slice(Math.max(0, i - 20), i)
        if (/(^|[^A-Za-z_$])(return|throw|yield|await)\s*$/.test(tail)) obj = true
        if (/=>\s*$/.test(tail)) obj = false
        if (prev === '(') {
          const tail2 = code.slice(Math.max(0, i - 40), i - 1)
          if (/=>\s*\($/.test(tail2)) obj = true
        }
        // 计算行列
        const before = code.slice(0, i)
        const line = before.split('\n').length
        const col = before.length - before.lastIndexOf('\n')
        log.push(`{ at line ${line}: prevChar=${JSON.stringify(prev)}, obj=${obj}, context=${JSON.stringify(code.slice(Math.max(0,i-8), i+12))}`)
        stack.push({ q: 0, obj, tag: '{' }); top++; out += ch; i++; continue
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        stack.pop(); top = Math.max(0, top - 1); out += ch; i++; continue
      }
      if (ch === '?') {
        stack[top].q += 1; out += ch; i++; continue
      }
      if (ch === ':' && (i + 1 < code.length && ![':', '='].includes(code[i + 1]))) {
        if (stack[top].q > 0) {
          stack[top].q -= 1; out += ch; i++; continue
        }
        if (stack[top].obj) { out += ch; i++; continue }
        const tlen = readTypeExpr(code, i + 1)
        if (tlen > 0) {
          const after = code[i + 1 + tlen]
          if (!after || /[,)\{\};=\s]/.test(after)) {
            const before = code.slice(0, i)
            const line = before.split('\n').length
            log.push(`  strip ':' @line ${line}: ${JSON.stringify(code.slice(i, i+1+tlen))}`)
            i += 1 + tlen
            continue
          }
        }
      }
      out += ch
      i++
    }
    code = out
    console.log('--- decision log ---')
    console.log(log.join('\n'))
  }
  code = code.replace(/\s+(as|is)\s+[A-Za-z_][\w<>\[\]\|&]*/g, '')
  code = code.replace(/([A-Za-z0-9_\)\]])\s*!(?!=)/g, '$1')
  code = code.replace(/(new\s+)?(Set|Map|Array|Record|Promise)\s*<[^>]*>/g, (m, prefix, type) => (prefix || '') + type)
  code = code.replace(/\s+as\s+const\b/g, '')
  code = code.replace(/\s+satisfies\s+[^\n;]+/g, '')
  return code
}

const src = readFileSync(resolve(srcDir, 'engine', 'emotionTag.ts'), 'utf8')
const out = transpileTS(src)
writeFileSync(resolve(__dirname, 'debug_emotion.js'), out, 'utf8')
console.log('\n=== output head ===')
console.log(out.split('\n').slice(0, 12).join('\n'))
