import { useState } from 'react'
import styles from './PlayButton.module.css'

type State = 'idle' | 'playing' | 'error'

const labels: Record<State, string> = {
  idle: '再生',
  playing: '再生中',
  error: '再生できませんでした',
}

interface Props {
  /** 再生する処理。再生が終わると完了する Promise を返す */
  onPlay: () => Promise<void>
  /** 読み上げソフト向けの説明（例: 「light の音声」） */
  label: string
}

// 押すたびに最初から再生する（docs/specs/study-cards.md 9 章: 自動再生はしない）
export function PlayButton({ onPlay, label }: Props) {
  const [state, setState] = useState<State>('idle')

  function handleClick() {
    setState('playing')
    onPlay()
      .then(() => setState('idle'))
      .catch((e: unknown) => {
        console.error(e)
        setState('error')
      })
  }

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        data-state={state}
        onClick={handleClick}
        aria-label={`${label}（${labels[state]}）`}
      >
        {state === 'error' ? '!' : '▶'}
      </button>
      {/* タッチ端末では title が見えないため、失敗したことを文字でも出す */}
      {state === 'error' && (
        <span className={styles.error} role="alert">
          再生できません
        </span>
      )}
    </span>
  )
}
