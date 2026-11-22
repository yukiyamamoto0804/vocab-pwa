import { useState } from 'react'
import type { ItemRecord } from '../../db/types'
import {
  clozeHint,
  clozeSegments,
  highlightSegments,
  letterCount,
} from '../../features/cards/cloze'
import { FitContent } from './FitContent'
import styles from './JaFront.module.css'

interface Props {
  item: ItemRecord
  /** 表面に使う用法の位置（例文の中に該当語が見つかるもの） */
  senseIndex: number
}

/** 空欄の表示。どの単語でも同じ長さにして、長さから答えを推測できないようにする */
const BLANK = '＿＿＿＿＿'

// 日本語 → 解説の表面（docs/specs/study-cards.md 3 章「日本語 → 解説」）。
// 太字にした訳と、該当語を空欄にした英文を出す。ヒントは押したときだけ出す。
// カードごとに置き直すので、ヒントは閉じた状態から始まる
export function JaFront({ item, senseIndex }: Props) {
  const [hintOpen, setHintOpen] = useState(false)
  const sense = item.senses[senseIndex]
  const cloze = clozeSegments(sense, item.word) ?? []

  return (
    <div className={styles.front}>
      {/* 訳と例文が長くてもヒントのボタンが切れないよう、文字を縮めて収める */}
      <FitContent>
        <div className={styles.texts}>
          <p className={styles.translation}>
            {highlightSegments(sense).map((s, i) =>
              s.mark ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: 文を分けた部分は並びが変わらない
                <strong key={i}>{s.text}</strong>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同上
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
          <p className={styles.example} lang="en">
            {cloze.map((s, i) =>
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
        </div>
      </FitContent>
      <div className={styles.hintBand} data-no-flip>
        {hintOpen ? (
          <p className={styles.hintText} lang="en">
            {/* ヒントは例文の中の形（ran など）ではなく、基本形（見出し語）で作る */}
            {clozeHint(item.word)}（{letterCount(item.word)} 文字）
          </p>
        ) : (
          <button
            type="button"
            className={styles.hintButton}
            onClick={() => setHintOpen(true)}
          >
            ヒント
          </button>
        )}
      </div>
      <p className={styles.flipHint}>タップして裏返す</p>
    </div>
  )
}
