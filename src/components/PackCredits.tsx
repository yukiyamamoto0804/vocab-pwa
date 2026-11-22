import type { ReactNode } from 'react'
import { linkify } from '../lib/linkify'
import styles from './PackCredits.module.css'

// 教材パックの作成日・ライセンス・出典（manifest.json の createdAt・license・attribution）を表示する（docs/specs/demo-pack.md 6 章）。
// 出典の中の URL は https・http のものだけをリンクにする。children に渡した行（<dt>・<dd>）は前に並べる
export function PackCredits({
  createdAt,
  license,
  attribution,
  children,
}: {
  createdAt?: string
  license?: string
  attribution?: string
  children?: ReactNode
}) {
  if (!createdAt && !license && !attribution && !children) return null
  return (
    <dl className={styles.credits}>
      {children}
      {createdAt && (
        <>
          <dt>作成日</dt>
          <dd>{createdAt}</dd>
        </>
      )}
      {license && (
        <>
          <dt>ライセンス</dt>
          <dd>{license}</dd>
        </>
      )}
      {attribution && (
        <>
          <dt>出典</dt>
          <dd className={styles.attribution}>
            {withOffsets(linkify(attribution)).map(({ part, at }) =>
              part.href ? (
                <a
                  key={at}
                  href={part.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {part.text}
                </a>
              ) : (
                <span key={at}>{part.text}</span>
              ),
            )}
          </dd>
        </>
      )}
    </dl>
  )
}

/** 各部分が文の何文字目から始まるか（同じ文やリンクが複数回出ても重ならない key にする） */
function withOffsets<T extends { text: string }>(parts: T[]) {
  let at = 0
  return parts.map((part) => {
    const item = { part, at }
    at += part.text.length
    return item
  })
}
