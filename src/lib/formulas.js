const ERRORS = {
  cycle: '#CYCLE!',
  div: '#DIV/0!',
  ref: '#REF!',
  value: '#VALUE!',
  name: '#NAME?',
  na: '#N/A',
}

export function colLabel(index) {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

export function parseA1(token) {
  const m = String(token).toUpperCase().replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  const col = m[1].split('').reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
  const row = Number(m[2]) - 1
  if (row < 0 || col < 0) return null
  return { row, col }
}

function err(code) {
  return { t: 'e', v: code }
}

function num(v) {
  return { t: 'n', v }
}

function str(v) {
  return { t: 's', v: String(v) }
}

function bool(v) {
  return { t: 'b', v: Boolean(v) }
}

function list(v) {
  return { t: 'l', v }
}

function isEmpty(val) {
  return val?.empty || (val?.t === 's' && val.v === '') || val == null
}

function asNumber(val) {
  if (!val || val.empty) return 0
  if (val.t === 'e') return val
  if (val.t === 'n') return val.v
  if (val.t === 'b') return val.v ? 1 : 0
  if (val.t === 's') {
    const trimmed = val.v.trim()
    if (trimmed === '') return 0
    if (trimmed.endsWith('%')) {
      const n = Number(trimmed.slice(0, -1))
      return Number.isNaN(n) ? err(ERRORS.value) : n / 100
    }
    const n = Number(trimmed.replace(/,/g, ''))
    return Number.isNaN(n) ? err(ERRORS.value) : n
  }
  return err(ERRORS.value)
}

function asString(val) {
  if (!val || val.empty) return ''
  if (val.t === 'e') return val.v
  if (val.t === 'b') return val.v ? 'TRUE' : 'FALSE'
  return String(val.v)
}

function truthy(val) {
  if (!val || val.empty) return false
  if (val.t === 'e') return false
  if (val.t === 'b') return val.v
  if (val.t === 'n') return val.v !== 0
  if (val.t === 's') return val.v !== '' && val.v !== 'FALSE'
  return true
}

function flatten(val) {
  if (!val) return []
  if (val.t === 'l') return val.v.flatMap(flatten)
  return [val]
}

function tokenize(src) {
  const tokens = []
  let i = 0
  const s = src.trim()
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i += 1
      continue
    }
    if (c === '"') {
      let j = i + 1
      let out = ''
      while (j < s.length) {
        if (s[j] === '"' && s[j + 1] === '"') {
          out += '"'
          j += 2
          continue
        }
        if (s[j] === '"') break
        out += s[j]
        j += 1
      }
      tokens.push({ k: 'str', v: out })
      i = j + 1
      continue
    }
    if (c === "'" && /[A-Za-z]/.test(s[i + 1] || '')) {
      let j = i + 1
      let name = ''
      while (j < s.length && s[j] !== "'") {
        name += s[j]
        j += 1
      }
      i = j + 1
      if (s[i] === '!') i += 1
      continue
    }
    if (/[0-9.]/.test(c) && (c !== '.' || /[0-9]/.test(s[i + 1] || ''))) {
      const m = s.slice(i).match(/^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/)
      tokens.push({ k: 'num', v: Number(m[0]) })
      i += m[0].length
      if (s[i] === '%') {
        tokens[tokens.length - 1].v /= 100
        i += 1
      }
      continue
    }
    const refMatch = s.slice(i).match(/^\$?[A-Za-z]+\$?\d+/)
    if (refMatch && parseA1(refMatch[0].replace(/\$/g, '')) && s[i + refMatch[0].length] !== '(') {
      tokens.push({ k: 'ref', v: refMatch[0].replace(/\$/g, '').toUpperCase() })
      i += refMatch[0].length
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_.]*/)
      const raw = m[0]
      const upper = raw.toUpperCase()
      if (upper === 'TRUE' || upper === 'FALSE') tokens.push({ k: 'bool', v: upper === 'TRUE' })
      else tokens.push({ k: 'id', v: upper })
      i += raw.length
      continue
    }
    const two = s.slice(i, i + 2)
    if (['<=', '>=', '<>'].includes(two)) {
      tokens.push({ k: 'op', v: two })
      i += 2
      continue
    }
    if ('+-*/^()%,&<>='.includes(c)) {
      tokens.push({ k: 'op', v: c })
      i += 1
      continue
    }
    tokens.push({ k: 'op', v: c })
    i += 1
  }
  return tokens
}

function parse(tokens) {
  let i = 0
  const peek = () => tokens[i]
  const eat = (v) => {
    if (peek()?.v === v) {
      i += 1
      return true
    }
    return false
  }

  function comparison() {
    let node = concat()
    const op = peek()
    if (op?.k === 'op' && ['<', '>', '<=', '>=', '=', '<>'].includes(op.v)) {
      i += 1
      node = { k: 'bin', op: op.v, a: node, b: concat() }
    }
    return node
  }

  function concat() {
    let node = additive()
    while (eat('&')) node = { k: 'bin', op: '&', a: node, b: additive() }
    return node
  }

  function additive() {
    let node = multiplicative()
    while (peek()?.k === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = peek().v
      i += 1
      node = { k: 'bin', op, a: node, b: multiplicative() }
    }
    return node
  }

  function multiplicative() {
    let node = power()
    while (peek()?.k === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = peek().v
      i += 1
      node = { k: 'bin', op, a: node, b: power() }
    }
    return node
  }

  function power() {
    let node = unary()
    while (eat('^')) node = { k: 'bin', op: '^', a: node, b: unary() }
    return node
  }

  function unary() {
    if (eat('+')) return unary()
    if (eat('-')) return { k: 'neg', a: unary() }
    return postfix()
  }

  function postfix() {
    let node = primary()
    if (eat('%')) node = { k: 'pct', a: node }
    return node
  }

  function primary() {
    const tok = peek()
    if (!tok) return { k: 'num', v: 0 }
    if (tok.k === 'num') {
      i += 1
      return { k: 'num', v: tok.v }
    }
    if (tok.k === 'str') {
      i += 1
      return { k: 'str', v: tok.v }
    }
    if (tok.k === 'bool') {
      i += 1
      return { k: 'bool', v: tok.v }
    }
    if (tok.k === 'ref') {
      i += 1
      if (eat(':')) {
        const end = peek()
        if (end?.k === 'ref') {
          i += 1
          return { k: 'range', a: tok.v, b: end.v }
        }
      }
      return { k: 'ref', v: tok.v }
    }
    if (tok.k === 'id') {
      i += 1
      if (eat('(')) {
        const args = []
        if (peek()?.v !== ')') {
          args.push(comparison())
          while (eat(',')) args.push(comparison())
        }
        eat(')')
        return { k: 'fn', name: tok.v, args }
      }
      return { k: 'id', v: tok.v }
    }
    if (eat('(')) {
      const inner = comparison()
      eat(')')
      return inner
    }
    i += 1
    return { k: 'num', v: 0 }
  }

  const ast = comparison()
  if (i < tokens.length) return { k: 'err', v: ERRORS.value }
  return ast
}

function compare(a, b, op) {
  if (a.t === 'e') return a
  if (b.t === 'e') return b
  const an = asNumber(a)
  const bn = asNumber(b)
  const numeric = typeof an !== 'object' && typeof bn !== 'object'
  let left = numeric ? an : asString(a)
  let right = numeric ? bn : asString(b)
  let ok = false
  if (op === '=') ok = left === right
  else if (op === '<>') ok = left !== right
  else if (op === '<') ok = left < right
  else if (op === '>') ok = left > right
  else if (op === '<=') ok = left <= right
  else if (op === '>=') ok = left >= right
  return bool(ok)
}

function matchCriteria(val, criteria) {
  const c = asString(criteria)
  const m = c.match(/^(<=|>=|<>|=|<|>)(.*)$/)
  if (m) return truthy(compare(val, coerceLiteral(m[2]), m[1] === '=' ? '=' : m[1]))
  if (c.includes('*') || c.includes('?')) {
    const re = new RegExp('^' + c.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
    return re.test(asString(val))
  }
  return asString(val).toLowerCase() === c.toLowerCase() || (typeof asNumber(val) !== 'object' && asNumber(val) === asNumber(criteria))
}

function coerceLiteral(text) {
  if (text === 'TRUE') return bool(true)
  if (text === 'FALSE') return bool(false)
  if (text.startsWith('"') && text.endsWith('"')) return str(text.slice(1, -1))
  const n = Number(text)
  return Number.isNaN(n) ? str(text) : num(n)
}

function rangeCells(a, b) {
  const start = parseA1(a)
  const end = parseA1(b)
  if (!start || !end) return []
  const r1 = Math.min(start.row, end.row)
  const r2 = Math.max(start.row, end.row)
  const c1 = Math.min(start.col, end.col)
  const c2 = Math.max(start.col, end.col)
  const cells = []
  for (let r = r1; r <= r2; r += 1) {
    for (let c = c1; c <= c2; c += 1) cells.push({ row: r, col: c })
  }
  return cells
}

function evalAst(node, ctx) {
  if (!node) return num(0)
  if (node.k === 'err') return err(node.v)
  if (node.k === 'num') return num(node.v)
  if (node.k === 'str') return str(node.v)
  if (node.k === 'bool') return bool(node.v)
  if (node.k === 'neg') {
    const v = asNumber(evalAst(node.a, ctx))
    return typeof v === 'object' ? v : num(-v)
  }
  if (node.k === 'pct') {
    const v = asNumber(evalAst(node.a, ctx))
    return typeof v === 'object' ? v : num(v / 100)
  }
  if (node.k === 'ref') {
    const ref = parseA1(node.v)
    if (!ref) return err(ERRORS.ref)
    return ctx.get(ref.row, ref.col)
  }
  if (node.k === 'range') {
    const cells = rangeCells(node.a, node.b)
    return list(cells.map((cell) => ctx.get(cell.row, cell.col)))
  }
  if (node.k === 'id') return err(ERRORS.name)
  if (node.k === 'bin') {
    const a = evalAst(node.a, ctx)
    const b = evalAst(node.b, ctx)
    if (node.op === '&') return str(asString(a) + asString(b))
    if (['<', '>', '<=', '>=', '=', '<>'].includes(node.op)) return compare(a, b, node.op)
    const av = asNumber(a)
    const bv = asNumber(b)
    if (typeof av === 'object') return av
    if (typeof bv === 'object') return bv
    if (node.op === '+') return num(av + bv)
    if (node.op === '-') return num(av - bv)
    if (node.op === '*') return num(av * bv)
    if (node.op === '/') return bv === 0 ? err(ERRORS.div) : num(av / bv)
    if (node.op === '^') return num(av ** bv)
  }
  if (node.k === 'fn') return callFn(node.name, node.args.map((arg) => evalAst(arg, ctx)), ctx, node.args)
  return err(ERRORS.value)
}

function numbersOf(args) {
  return flatten({ t: 'l', v: args }).filter((v) => !isEmpty(v) && v.t !== 'e' && typeof asNumber(v) !== 'object').map((v) => asNumber(v))
}

function callFn(name, args, ctx, rawArgs) {
  const fn = name.toUpperCase()
  if (fn === 'SUM') return num(numbersOf(args).reduce((a, b) => a + b, 0))
  if (fn === 'AVERAGE' || fn === 'AVG') {
    const ns = numbersOf(args)
    return ns.length ? num(ns.reduce((a, b) => a + b, 0) / ns.length) : err(ERRORS.div)
  }
  if (fn === 'MIN') return numbersOf(args).length ? num(Math.min(...numbersOf(args))) : err(ERRORS.value)
  if (fn === 'MAX') return numbersOf(args).length ? num(Math.max(...numbersOf(args))) : err(ERRORS.value)
  if (fn === 'COUNT') return num(numbersOf(args).length)
  if (fn === 'COUNTA') return num(flatten({ t: 'l', v: args }).filter((v) => !isEmpty(v)).length)
  if (fn === 'ABS') {
    const n = asNumber(args[0])
    return typeof n === 'object' ? n : num(Math.abs(n))
  }
  if (fn === 'ROUND') {
    const n = asNumber(args[0])
    const d = asNumber(args[1] || num(0))
    if (typeof n === 'object') return n
    const p = 10 ** (typeof d === 'object' ? 0 : d)
    return num(Math.round(n * p) / p)
  }
  if (fn === 'SQRT') {
    const n = asNumber(args[0])
    return typeof n === 'object' ? n : n < 0 ? err(ERRORS.value) : num(Math.sqrt(n))
  }
  if (fn === 'POWER') {
    const n = asNumber(args[0])
    const p = asNumber(args[1])
    if (typeof n === 'object') return n
    if (typeof p === 'object') return p
    return num(n ** p)
  }
  if (fn === 'LOG10' || fn === 'LN' || fn === 'EXP' || fn === 'LOG') {
    const n = asNumber(args[0])
    if (typeof n === 'object') return n
    if (fn === 'EXP') return num(Math.exp(n))
    if (n <= 0) return err(ERRORS.value)
    if (fn === 'LN') return num(Math.log(n))
    if (fn === 'LOG10') return num(Math.log10(n))
    const base = asNumber(args[1] || num(10))
    if (typeof base === 'object') return base
    return base <= 0 || base === 1 ? err(ERRORS.value) : num(Math.log(n) / Math.log(base))
  }
  if (fn === 'IF') {
    if (args[0]?.t === 'e') return args[0]
    return truthy(args[0]) ? (args[1] ?? bool(true)) : (args[2] ?? bool(false))
  }
  if (fn === 'AND') return bool(args.every(truthy))
  if (fn === 'OR') return bool(args.some(truthy))
  if (fn === 'NOT') return bool(!truthy(args[0]))
  if (fn === 'IFERROR') return args[0]?.t === 'e' ? (args[1] ?? str('')) : args[0]
  if (fn === 'LEN') return num(asString(args[0]).length)
  if (fn === 'TRIM') return str(asString(args[0]).trim())
  if (fn === 'UPPER') return str(asString(args[0]).toUpperCase())
  if (fn === 'LOWER') return str(asString(args[0]).toLowerCase())
  if (fn === 'PROPER') return str(asString(args[0]).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))
  if (fn === 'LEFT') {
    const n = asNumber(args[1] || num(1))
    if (typeof n === 'object') return n
    return str(asString(args[0]).slice(0, Math.max(0, n)))
  }
  if (fn === 'RIGHT') {
    const s = asString(args[0])
    const n = asNumber(args[1] || num(1))
    return str(s.slice(s.length - (typeof n === 'object' ? 1 : n)))
  }
  if (fn === 'MID') {
    const s = asString(args[0])
    const start = asNumber(args[1])
    const len = asNumber(args[2] || num(s.length))
    if (typeof start === 'object') return start
    return str(s.slice(Math.max(0, start - 1), Math.max(0, start - 1) + (typeof len === 'object' ? s.length : len)))
  }
  if (fn === 'CONCAT' || fn === 'CONCATENATE') return str(args.map(asString).join(''))
  if (fn === 'TODAY') {
    const d = new Date()
    return str(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  if (fn === 'NOW') return str(new Date().toLocaleString('id-ID'))
  if (fn === 'SUMIF' || fn === 'COUNTIF') {
    const range = flatten(args[0])
    const crit = args[1]
    const sumRange = fn === 'SUMIF' ? flatten(args[2] || args[0]) : range
    let total = 0
    let count = 0
    range.forEach((val, idx) => {
      if (matchCriteria(val, crit)) {
        count += 1
        const n = asNumber(sumRange[idx] || num(0))
        if (typeof n !== 'object') total += n
      }
    })
    return fn === 'SUMIF' ? num(total) : num(count)
  }
  if (fn === 'MEDIAN') {
    const ns = numbersOf(args).sort((a, b) => a - b)
    if (!ns.length) return err(ERRORS.value)
    const mid = Math.floor(ns.length / 2)
    return num(ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2)
  }
  if (fn === 'PRODUCT') return num(numbersOf(args).reduce((a, b) => a * b, 1))
  if (fn === 'STDEV') {
    const ns = numbersOf(args)
    if (ns.length < 2) return err(ERRORS.div)
    const mean = ns.reduce((a, b) => a + b, 0) / ns.length
    return num(Math.sqrt(ns.reduce((a, b) => a + (b - mean) ** 2, 0) / (ns.length - 1)))
  }
  if (fn === 'INT') {
    const n = asNumber(args[0])
    return typeof n === 'object' ? n : num(Math.trunc(n))
  }
  if (fn === 'MOD') {
    const n = asNumber(args[0])
    const d = asNumber(args[1])
    if (typeof n === 'object') return n
    if (typeof d === 'object' || d === 0) return err(ERRORS.div)
    return num(((n % d) + d) % d)
  }
  if (fn === 'ROUNDUP') {
    const n = asNumber(args[0])
    const d = asNumber(args[1] || num(0))
    if (typeof n === 'object') return n
    const p = 10 ** (typeof d === 'object' ? 0 : d)
    return num(Math.ceil(n * p) / p)
  }
  if (fn === 'ROUNDDOWN') {
    const n = asNumber(args[0])
    const d = asNumber(args[1] || num(0))
    if (typeof n === 'object') return n
    const p = 10 ** (typeof d === 'object' ? 0 : d)
    return num(Math.floor(n * p) / p)
  }
  if (fn === 'TEXTJOIN') {
    const delim = asString(args[0])
    const skip = truthy(args[1])
    const parts = flatten({ t: 'l', v: args.slice(2) }).filter((v) => !skip || !isEmpty(v)).map(asString)
    return str(parts.join(delim))
  }
  if (fn === 'SUBSTITUTE') return str(asString(args[0]).split(asString(args[1])).join(asString(args[2])))
  if (fn === 'SEARCH' || fn === 'FIND') {
    const needle = asString(args[0])
    const hay = asString(args[1])
    const start = Math.max(0, (typeof asNumber(args[2] || num(1)) === 'object' ? 1 : asNumber(args[2] || num(1))) - 1)
    const idx = fn === 'FIND' ? hay.indexOf(needle, start) : hay.toLowerCase().indexOf(needle.toLowerCase(), start)
    return idx < 0 ? err(ERRORS.value) : num(idx + 1)
  }
  if (fn === 'VALUE') {
    const n = asNumber(args[0])
    return typeof n === 'object' ? n : num(n)
  }
  if (fn === 'YEAR' || fn === 'MONTH' || fn === 'DAY') {
    const d = new Date(asString(args[0]))
    if (Number.isNaN(d.getTime())) return err(ERRORS.value)
    return num(fn === 'YEAR' ? d.getFullYear() : fn === 'MONTH' ? d.getMonth() + 1 : d.getDate())
  }
  if (fn === 'LARGE' || fn === 'SMALL') {
    const ns = numbersOf([args[0]]).sort((a, b) => fn === 'LARGE' ? b - a : a - b)
    const k = asNumber(args[1] || num(1))
    if (typeof k === 'object' || k < 1 || k > ns.length) return err(ERRORS.value)
    return num(ns[k - 1])
  }
  if (fn === 'RANK') {
    const n = asNumber(args[0])
    const ns = numbersOf([args[1]]).sort((a, b) => b - a)
    if (typeof n === 'object') return n
    const idx = ns.indexOf(n)
    return idx < 0 ? err(ERRORS.na) : num(idx + 1)
  }
  if (fn === 'RAND') return num(Math.random())
  if (fn === 'RANDBETWEEN') {
    const a = asNumber(args[0])
    const b = asNumber(args[1])
    if (typeof a === 'object' || typeof b === 'object') return err(ERRORS.value)
    const lo = Math.min(a, b)
    const hi = Math.max(a, b)
    return num(Math.floor(Math.random() * (hi - lo + 1)) + lo)
  }
  if (fn === 'VLOOKUP') {
    const lookup = args[0]
    const table = args[1]
    const index = asNumber(args[2])
    if (typeof index === 'object') return index
    const rows = []
    if (rawArgs[1]?.k === 'range') {
      const cells = rangeCells(rawArgs[1].a, rawArgs[1].b)
      const start = parseA1(rawArgs[1].a)
      const end = parseA1(rawArgs[1].b)
      const width = Math.abs(end.col - start.col) + 1
      for (let r = 0; r < cells.length; r += width) {
        rows.push(cells.slice(r, r + width).map((cell) => ctx.get(cell.row, cell.col)))
      }
    } else if (table.t === 'l') {
      rows.push(flatten(table))
    }
    const found = rows.find((row) => asString(row[0]).toLowerCase() === asString(lookup).toLowerCase() || (typeof asNumber(row[0]) !== 'object' && asNumber(row[0]) === asNumber(lookup)))
    if (!found) return err(ERRORS.na)
    return found[index - 1] || err(ERRORS.ref)
  }
  if (fn === 'INDEX') {
    const rowNum = asNumber(args[1] ?? num(1))
    const colNum = args[2] == null ? 1 : asNumber(args[2])
    if (typeof rowNum === 'object') return rowNum
    if (typeof colNum === 'object') return colNum
    if (rawArgs[0]?.k === 'range') {
      const start = parseA1(rawArgs[0].a)
      const end = parseA1(rawArgs[0].b)
      if (!start || !end) return err(ERRORS.ref)
      const r1 = Math.min(start.row, end.row)
      const c1 = Math.min(start.col, end.col)
      const height = Math.abs(end.row - start.row) + 1
      const width = Math.abs(end.col - start.col) + 1
      if (rowNum < 1 || rowNum > height || colNum < 1 || colNum > width) return err(ERRORS.ref)
      return ctx.get(r1 + rowNum - 1, c1 + colNum - 1)
    }
    const values = flatten(args[0])
    if (rowNum < 1 || rowNum > values.length) return err(ERRORS.ref)
    return values[rowNum - 1]
  }
  if (fn === 'MATCH') {
    const lookup = args[0]
    const values = flatten(args[1])
    const idx = values.findIndex((val) => asString(val).toLowerCase() === asString(lookup).toLowerCase() || (typeof asNumber(val) !== 'object' && typeof asNumber(lookup) !== 'object' && asNumber(val) === asNumber(lookup)))
    return idx < 0 ? err(ERRORS.na) : num(idx + 1)
  }
  return err(ERRORS.name)
}

export function parseRaw(raw) {
  if (raw == null) return { empty: true, t: 's', v: '' }
  const text = String(raw)
  if (text === '') return { empty: true, t: 's', v: '' }
  if (text.startsWith("'")) return { t: 's', v: text.slice(1) }
  if (text.endsWith('%') && !Number.isNaN(Number(text.slice(0, -1)))) return num(Number(text.slice(0, -1)) / 100)
  const n = Number(text.replace(/,/g, ''))
  if (text.trim() !== '' && !Number.isNaN(n) && !/^0\d+/.test(text.trim())) return num(n)
  return { t: 's', v: text }
}

export function evaluateGrid(cells) {
  const cache = new Map()
  const visiting = new Set()

  function get(row, col) {
    const key = `${row}:${col}`
    if (cache.has(key)) return cache.get(key)
    if (visiting.has(key)) return err(ERRORS.cycle)
    const raw = cells[row]?.[col] ?? ''
    if (typeof raw === 'string' && raw.startsWith('=')) {
      visiting.add(key)
      let result
      try {
        const ast = parse(tokenize(raw.slice(1)))
        result = evalAst(ast, { get })
      } catch {
        result = err(ERRORS.value)
      }
      visiting.delete(key)
      cache.set(key, result)
      return result
    }
    const parsed = parseRaw(raw)
    cache.set(key, parsed)
    return parsed
  }

  const display = cells.map((row, r) => row.map((_, c) => get(r, c)))
  return { get, display }
}

export function displayOf(val, fmt) {
  if (!val || val.empty) return ''
  if (val.t === 'e') return val.v
  if (val.t === 'b') return val.v ? 'TRUE' : 'FALSE'
  if (val.t === 's') return val.v
  if (val.t === 'n') {
    if (!Number.isFinite(val.v)) return ERRORS.value
    if (fmt === 'currency') return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val.v)
    if (fmt === 'percent') return new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 }).format(val.v)
    if (fmt === 'number') return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val.v)
    if (fmt === 'date') return new Date(Math.round((val.v - 25569) * 86400000)).toLocaleDateString('id-ID')
    if (fmt === 'accounting') return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 2 }).format(val.v)
    if (Number.isInteger(val.v)) return new Intl.NumberFormat('id-ID').format(val.v)
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 6 }).format(val.v)
  }
  return ''
}

export function rangeStats(display, r1, c1, r2, c2) {
  const nums = []
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r += 1) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c += 1) {
      const val = display[r]?.[c]
      if (val?.t === 'n' && Number.isFinite(val.v)) nums.push(val.v)
    }
  }
  if (!nums.length) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return { sum, avg: sum / nums.length, count: nums.length, min: Math.min(...nums), max: Math.max(...nums) }
}
