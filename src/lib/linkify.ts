// 文の中の URL を見つけて、文字列とリンクの並びに分ける（docs/specs/demo-pack.md 6 章）。
// 教材パックの中身は信用できない入力として扱い、https:// と http:// で始まるものだけをリンクにする

export type LinkifiedPart = { text: string; href?: string }

/** URL の始まり。そこから空白・括弧・読点・句点の手前までを URL とみなす */
const URL_PATTERN = /https?:\/\/[^\s()（）、。]+/g

export function linkify(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    // 文の区切りとして URL の後ろに付いた「.」「,」はリンクに含めない
    const url = match[0].replace(/[.,]+$/, '')
    const start = match.index
    if (start > last) parts.push({ text: text.slice(last, start) })
    parts.push({ text: url, href: url })
    last = start + url.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
