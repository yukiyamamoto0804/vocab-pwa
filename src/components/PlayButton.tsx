import { useRef, useState } from 'react'
import styles from './PlayButton.module.css'

type State = 'idle' | 'playing' | 'error'

/** 大きさ。large は学習カードの表面、huge は音声だけの表面（単語の音声 → 解説、例文の音声 → 解説）に使う */
export type PlayButtonSize = 'normal' | 'large' | 'huge'

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
  size?: PlayButtonSize
}

// 押すたびに最初から再生する（docs/specs/study-cards.md 9 章: 自動再生はしない）
export function PlayButton({ onPlay, label, size = 'normal' }: Props) {
  const [state, setState] = useState<State>('idle')
  /** 失敗の理由のうち、利用者に伝えたいもの（例: 端末に英語の読み上げの声がない） */
  const [reason, setReason] = useState<string>()

  /** 押した回数。再生中にもう一度押したとき、前の再生の結果で表示を戻さないようにする */
  const pressCount = useRef(0)

  function handleClick() {
    pressCount.current += 1
    const press = pressCount.current
    setState('playing')
    setReason(undefined)
    onPlay()
      .then(() => {
        if (press === pressCount.current) setState('idle')
      })
      .catch((e: unknown) => {
        if (press !== pressCount.current) return
        console.error(e)
        setState('error')
        setReason(userMessageOf(e))
      })
  }

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        data-state={state}
        data-size={size}
        onClick={handleClick}
        aria-label={`${label}（${labels[state]}）`}
      >
        {state === 'error' ? '!' : '▶'}
      </button>
      {/* タッチ端末では title が見えないため、失敗したことを文字でも出す */}
      {state === 'error' && (
        <span className={styles.error} role="alert">
          {reason ?? '再生できません'}
        </span>
      )}
    </span>
  )
}

/** 失敗に userMessage（画面に出す文言）が付いていれば返す */
function userMessageOf(e: unknown): string | undefined {
  if (
    typeof e === 'object' &&
    e !== null &&
    'userMessage' in e &&
    typeof e.userMessage === 'string'
  )
    return e.userMessage
  return undefined
}
