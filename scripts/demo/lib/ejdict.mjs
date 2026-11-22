// EJDict-hand の行から訳語の候補を作る（docs/specs/demo-pack.md 3 章「訳語の取り出し方」）。
// 目的は「訳が EJDict-hand の文字列から来ていること」を確かめることなので、候補は多めにできてよい。
// ただし、EJDict-hand にない文字列（言葉の途中を削ったものなど）は候補に入れない。

/** 対で扱う括弧（開き → 閉じ） */
const PAIRS = {
  '《': '》',
  '(': ')',
  '（': '）',
  '[': ']',
  '〈': '〉',
  '{': '}',
  '『': '』',
}
const CLOSERS = new Map(Object.entries(PAIRS).map(([o, c]) => [c, o]))

/** 括弧を消した位置の印（私用領域の文字。辞書には出てこない。最後に取り除く）。〈〉（目的語などの説明）を消した位置だけ、6 の判定のために別の印にする */
const MARK = '\ue000'
const MARK_OBJECT = '\ue001'

/**
 * 候補の先頭から外してよい助詞（長いものから当てる）。
 * 「で」「の」は外さない（「…でないかぎり」「でくの棒」のように、言葉の一部であることが多いため）
 */
const PARTICLES = ['から', 'より', 'を', 'に', 'が', 'と', 'へ']

const JAPANESE = /[぀-ヿ㐀-鿿豈-﫿]/

/** 括弧の対がそろっているか（入れ子も見る） */
export function isBalanced(text) {
  const stack = []
  for (const ch of text) {
    if (ch in PAIRS) stack.push(ch)
    else if (CLOSERS.has(ch)) {
      if (stack.pop() !== CLOSERS.get(ch)) return false
    }
  }
  return stack.length === 0
}

/** 《》を中身ごと消す（中に別の括弧があっても、《 から対応する 》 までをまとめて消す） */
function removeAngleNotes(text) {
  let out = ''
  let depth = 0
  for (const ch of text) {
    if (ch === '《') {
      if (depth === 0) out += MARK
      depth += 1
    } else if (ch === '》' && depth > 0) depth -= 1
    else if (depth === 0) out += ch
  }
  return out
}

/** 中身が英字だけの〈〉（〈C〉〈U〉など。名詞の数え方の印） */
const POS_MARK = /^〈[A-Za-z,]+〉$/

/** ()・（）・[]・〈〉・{} を、内側から対ごとに中身と一緒に消す */
const INNERMOST = /[(（[〈{][^()（）[\]〈〉{}]*[)）\]〉}]/g
function removeBrackets(text) {
  let prev
  let out = text
  do {
    prev = out
    out = out.replace(INNERMOST, (m) => {
      if (PAIRS[m[0]] !== m[m.length - 1]) return m
      // 〈C〉〈U〉のような品詞の印は、目的語などの説明ではないので、助詞を外す位置にしない
      return m[0] === '〈' && !POS_MARK.test(m) ? MARK_OBJECT : MARK
    })
  } while (out !== prev)
  return out
}

/** 候補の先頭が、消した括弧と「…」だけで、その最後が〈〉か「…」で、すぐ後に助詞が続く形なら、助詞を外した形も返す */
function withParticleVariants(piece) {
  const head = piece.match(/^[\ue000\ue001…]+/)
  const results = [piece]
  if (head && /[\ue001…]$/.test(head[0])) {
    const rest = piece.slice(head[0].length)
    const particle = PARTICLES.find((p) => rest.startsWith(p))
    if (particle) results.push(head[0] + rest.slice(particle.length))
  }
  return results
}

/** 印を取り除いた訳語。使えないもの（空・「=」で始まる・日本語を含まない）は undefined */
function clean(variant) {
  const word = variant
    .replace(/^[\ue000\ue001…]+/, '')
    .replace(/[\ue000\ue001]/g, '')
    .trim()
  if (!word || word.startsWith('=') || !JAPANESE.test(word)) return undefined
  return word
}

/**
 * 訳の欄から訳語の候補を作る（手順 2〜7）。対の合わない部分は捨て、そのことを skipped に返す
 * @param {string} body 訳の欄（タブの後ろ）
 * @param {Set<string>} [excluded] 使わない訳語
 */
export function extractCandidates(body, excluded = new Set()) {
  const skipped = []
  // 行全体で対がそろっていれば、行全体で括弧を消してから区切る（括弧が「 / 」をまたぐ行があるため）。
  // そろっていなければ、「 / 」で区切った部分ごとに判定し、そろわない部分だけを捨てる
  const sources = isBalanced(body)
    ? [body]
    : body.split(' / ').filter((p) => {
        const ok = isBalanced(p)
        if (!ok) skipped.push(p)
        return ok
      })
  const candidates = new Set()
  for (const source of sources) {
    const removed = removeBrackets(removeAngleNotes(source)).replace(
      /[『』]/g,
      '',
    )
    for (const raw of removed.split(/ \/ |[;,、・]/)) {
      // 先頭の空白と印の並びを詰める（「〈物〉を」の前の空白など）
      const piece = raw
        .trim()
        .replace(/^[\s\ue000\ue001]+/, (m) => m.replace(/\s/g, ''))
      const words = withParticleVariants(piece).map(clean).filter(Boolean)
      // 使わない訳語は、助詞を付けた形・外した形のどちらで載っていても、まとめて捨てる
      if (words.some((w) => excluded.has(w))) continue
      for (const w of words) candidates.add(w)
    }
  }
  return { candidates, skipped }
}

/**
 * 辞書の本文（行の並び）を読み、見出しごとの訳の欄の一覧にする（手順 1）。
 * 見出しの欄は「,」で区切り、前後の空白を削る。大文字・小文字は区別する
 * @param {string} text
 * @returns {Map<string, string[]>}
 */
export function parseDictionary(text) {
  const entries = new Map()
  for (const line of text.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const body = line.slice(tab + 1)
    for (const head of line.slice(0, tab).split(',')) {
      const key = head.trim()
      if (!key) continue
      const list = entries.get(key) ?? []
      list.push(body)
      entries.set(key, list)
    }
  }
  return entries
}

/** 見出しの訳語の候補をすべての行から集める */
export function candidatesFor(entries, head, excluded) {
  const all = new Set()
  const skipped = []
  for (const body of entries.get(head) ?? []) {
    const r = extractCandidates(body, excluded)
    for (const c of r.candidates) all.add(c)
    skipped.push(...r.skipped)
  }
  return { candidates: all, skipped }
}

/**
 * 見出し語を含む熟語の項目の見出し（空白を含み、見出し語を 1 つの単語として含み、括弧を含まないもの）
 */
export function idiomHeadsFor(entries, word) {
  const heads = []
  for (const head of entries.keys()) {
    if (!head.includes(' ') || /[()（）[\]〈〉{}《》]/.test(head)) continue
    if (head.split(/\s+/).includes(word)) heads.push(head)
  }
  return heads.sort()
}
