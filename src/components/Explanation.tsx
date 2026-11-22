import type { ReactNode } from 'react'
import type { ContentItem } from '../db/types'
import styles from './Explanation.module.css'

const SENSE_MARKS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

interface Props {
  item: ContentItem
  /** 見出し語の横に置くもの（音声の再生ボタンなど） */
  wordAside?: ReactNode
  /** 用法ごとに、例文の横に置くもの（例文の再生ボタンなど） */
  exampleAside?: (senseIndex: number) => ReactNode
}

// カードの裏面に出す解説（docs/specs/study-cards.md 2 章）
export function Explanation({ item, wordAside, exampleAside }: Props) {
  const numbered = item.senses.length > 1
  return (
    <div className={styles.explanation}>
      <div className={styles.head}>
        <h2 className={styles.word}>{item.word}</h2>
        {wordAside}
      </div>
      {item.senses.map((sense, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 用法に id はなく、並び替えない
        <section key={i} className={styles.sense}>
          <p className={styles.meanings}>
            {numbered && (
              <span className={styles.mark}>
                {SENSE_MARKS[i] ?? `${i + 1}.`}
              </span>
            )}
            {sense.meanings.map((m, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 同じ組が並ぶことがあり、並び替えない
              <span key={j} className={styles.meaning}>
                <span className={styles.pos}>{m.pos}</span>
                {m.meaning}
              </span>
            ))}
          </p>
          <div className={styles.exampleRow}>
            <p className={styles.example} lang="en">
              {sense.example}
            </p>
            {exampleAside?.(i)}
          </div>
          <p className={styles.translation}>{sense.exampleTranslation}</p>
        </section>
      ))}
      {item.idioms && item.idioms.length > 0 && (
        <section className={styles.idioms}>
          <h3 className={styles.idiomsTitle}>イディオム</h3>
          <ul>
            {item.idioms.map((idiom, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 同じイディオムが並ぶことがあり、並び替えない
              <li key={i}>
                <span lang="en">{idiom.phrase}</span>　{idiom.meaning}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
