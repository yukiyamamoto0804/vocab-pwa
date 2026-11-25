import type { Sense } from '../../db/types'
import { clozeSegments } from '../../features/cards/cloze'
import styles from './ClozeText.module.css'

/** 空欄の表示。どの単語でも同じ長さにして、長さから答えを推測できないようにする */
const BLANK = '＿＿＿＿＿'

interface Props {
  sense: Pick<Sense, 'example' | 'exampleTarget'>
  word: string
  className?: string
}

// 該当語を空欄にした英語の例文（docs/specs/study-cards.md 3 章）。
// 例文の中に該当語が見つからなければ、空欄なしで出す（「例文の音声」で起きうる。「例文の訳」では、見つからない用法は使わない）
export function ClozeText({ sense, word, className }: Props) {
  const segments = clozeSegments(sense, word) ?? [
    { text: sense.example, mark: false },
  ]
  return (
    <p className={className} lang="en">
      {segments.map((s, i) =>
        s.mark ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: 文を分けた部分は並びが変わらない
          <span key={i} className={styles.blank}>
            <span aria-hidden="true">{BLANK}</span>
            <span className={styles.srOnly}>（空欄）</span>
          </span>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同上
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  )
}
