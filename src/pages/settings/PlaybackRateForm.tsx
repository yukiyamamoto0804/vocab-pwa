import { useEffect, useState } from 'react'
import { PLAYBACK_RATES, type PlaybackRate } from '../../db/settings'
import {
  changePlaybackRate,
  currentPlaybackRate,
  loadPlaybackRate,
} from '../../features/audio/playbackRate'
import styles from './PlaybackRateForm.module.css'

// 音声を流す速さ（docs/specs/study-cards.md 9 章）。選ぶとすぐ保存し、次に流す音声から使う
export function PlaybackRateForm() {
  const [rate, setRate] = useState<PlaybackRate>(currentPlaybackRate)
  const [error, setError] = useState<'load' | 'save'>()

  // 学習記録を置き換えた後に作り直されたときも、保存した値を読み直す
  useEffect(() => {
    let active = true
    loadPlaybackRate().then(
      (loaded) => {
        if (active) setRate(loaded)
      },
      (e: unknown) => {
        console.error(e)
        if (active) setError('load')
      },
    )
    return () => {
      active = false
    }
  }, [])

  function change(next: PlaybackRate) {
    setRate(next)
    setError(undefined)
    changePlaybackRate(next).catch((e: unknown) => {
      console.error(e)
      // 失敗したら最後に保存できた値に戻っている。選び直せるよう画面も合わせる
      setRate(currentPlaybackRate())
      setError('save')
    })
  }

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        {PLAYBACK_RATES.map((r) => (
          <label key={r} className={styles.option}>
            <input
              type="radio"
              name="playback-rate"
              checked={rate === r}
              onChange={() => change(r)}
            />
            {r}倍
          </label>
        ))}
      </div>
      <p className={styles.note}>
        単語・例文の音声と、機械の音声の読み上げに使います。
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error === 'load'
            ? '設定を読み込めませんでした。選び直すと保存します。'
            : '設定を保存できませんでした。もう一度選んでください。'}
        </p>
      )}
    </div>
  )
}
