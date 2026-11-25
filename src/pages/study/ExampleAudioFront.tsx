import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { ItemRecord } from '../../db/types'
import { ClozeText } from './ClozeText'
import styles from './ExampleAudioFront.module.css'
import { FitContent } from './FitContent'

interface Props {
  item: ItemRecord
  /** 表面に使う用法の位置（例文の音声があるもの） */
  senseIndex: number
  /** 例文の音声の再生ボタン */
  playButton: ReactNode
  /** 空欄の英文を最初から表示するか（設定）。false ならボタンを押して表示する */
  initiallyShown: boolean
}

// 「例文の音声」の表面（docs/specs/study-cards.md 3 章「例文の音声」）。
// 大きな再生ボタンと、聞き取る手がかりとして空欄の英文を出す「例文を表示」ボタンを置く。
// カードごとに置き直すので、英文は設定どおりの状態（隠す・最初から出す）から始まる
export function ExampleAudioFront({
  item,
  senseIndex,
  playButton,
  initiallyShown,
}: Props) {
  // 設定の値は後から届くことがあるので、押したかどうかと分けて持ち、表示は 2 つから決める
  const [revealed, setRevealed] = useState(false)
  const shown = initiallyShown || revealed
  const sense = item.senses[senseIndex]
  /** 押して出した英文。押したボタンが消えるので、キーボードや読み上げソフトの操作の位置をここへ移す */
  const textRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (revealed) textRef.current?.focus()
  }, [revealed])

  return (
    <div className={styles.front}>
      <div className={styles.playBand} data-no-flip>
        {playButton}
      </div>
      {shown ? (
        // 例文が長くてもはみ出さないよう、文字を縮めて収める
        <FitContent>
          <div ref={textRef} tabIndex={-1} className={styles.revealed}>
            <ClozeText
              sense={sense}
              word={item.word}
              className={styles.example}
            />
          </div>
        </FitContent>
      ) : (
        <div className={styles.revealBand} data-no-flip>
          <button
            type="button"
            className={styles.revealButton}
            onClick={() => setRevealed(true)}
          >
            例文を表示
          </button>
        </div>
      )}
      {!shown && <div className={styles.spacer} />}
      <p className={styles.flipHint}>
        音声を聞いて意味を思い出したら、タップして裏返す
      </p>
    </div>
  )
}
