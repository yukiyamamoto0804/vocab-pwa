import type { ItemRecord, Sense } from '../../db/types'
import type { Random } from '../../lib/random'

// 日本語 → 解説の表面に出す、空欄の英文と太字の訳（docs/specs/study-cards.md 3 章「日本語 → 解説」）

/** 表示する文の一部。mark が true の部分を空欄（英文）や太字（訳）にする */
export interface Segment {
  text: string
  mark: boolean
}

/** 正規表現で特別な意味を持つ文字を、文字どおりに扱えるようにする */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const isLetter = (ch: string | undefined) =>
  ch !== undefined && /[A-Za-z]/.test(ch)

/**
 * text を、pattern に当てはまる部分とそれ以外に分ける。当てはまらなければ undefined。
 * wordBoundary が true なら、前後が英字の所（ほかの語の一部）は飛ばす。
 * 否定の後読み（(?<!…)）は古い iOS Safari で使えないため、位置を自分で確かめる
 */
function split(
  text: string,
  pattern: RegExp,
  wordBoundary = false,
): Segment[] | undefined {
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const start = match.index
    const end = start + match[0].length
    if (wordBoundary && (isLetter(text[start - 1]) || isLetter(text[end])))
      continue
    if (start > last)
      segments.push({ text: text.slice(last, start), mark: false })
    segments.push({ text: match[0], mark: true })
    last = end
  }
  if (segments.length === 0) return undefined
  if (last < text.length) segments.push({ text: text.slice(last), mark: false })
  return segments
}

/**
 * 例文を、空欄にする該当語とそれ以外に分ける。該当語はデータの exampleTarget（省略時は見出し語）。
 * 大文字・小文字を区別せず、前後が英字でない所だけを探す（light が flight の中に当たらないように）。
 * 複数あればすべて空欄にする。見つからなければ undefined
 */
export function clozeSegments(
  sense: Pick<Sense, 'example' | 'exampleTarget'>,
  word: string,
): Segment[] | undefined {
  // 前後に空白が付いたデータでも、語だけを空欄にする
  const target = (sense.exampleTarget ?? word).trim()
  if (target === '') return undefined
  return split(sense.example, new RegExp(escapeRegExp(target), 'gi'), true)
}

/** 訳を、太字にする部分（exampleTranslationTarget）とそれ以外に分ける。なければ全体を 1 つで返す */
export function highlightSegments(
  sense: Pick<Sense, 'exampleTranslation' | 'exampleTranslationTarget'>,
): Segment[] {
  const { exampleTranslation: text } = sense
  const target = sense.exampleTranslationTarget?.trim()
  const segments = target
    ? split(text, new RegExp(escapeRegExp(target), 'g'))
    : undefined
  return segments ?? [{ text, mark: false }]
}

/** 日本語 → 解説の表面に使える用法の位置（例文の中に該当語が見つかるもの） */
export function clozeSenseIndexes(
  item: Pick<ItemRecord, 'word' | 'senses'>,
): number[] {
  return item.senses.flatMap((sense, i) =>
    clozeSegments(sense, item.word) ? [i] : [],
  )
}

/**
 * 表面に使う用法を、使える用法からランダムに 1 つ選ぶ。使える用法がなければ 0。
 * 学習を始めるときに単語ごとに 1 回だけ選び、その回の学習の間は同じ用法を出す
 */
export function pickClozeSense(
  item: Pick<ItemRecord, 'word' | 'senses'>,
  random: Random = Math.random,
): number {
  const candidates = clozeSenseIndexes(item)
  return candidates[Math.floor(random() * candidates.length)] ?? 0
}

/** ヒント: 頭文字と、残りの英字の数だけの下線。英字以外（空白・ハイフンなど）はそのまま出す。例: light → l____ */
export function clozeHint(word: string): string {
  // 前後に空白が付いたデータでも、頭文字を出す
  return [...word.trim()]
    .map((ch, i) => (i === 0 || !isLetter(ch) ? ch : '_'))
    .join('')
}

/** ヒントに添える文字数（英字だけを数える） */
export function letterCount(word: string): number {
  return [...word].filter(isLetter).length
}
