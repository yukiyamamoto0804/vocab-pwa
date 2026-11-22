import { useEffect, useRef, useState } from 'react'
import { getExampleTextShown, saveExampleTextShown } from '../../db/settings'
import styles from './DisplaySettingsForm.module.css'

// 表面の表示の設定（docs/specs/study-cards.md 3 章）。選ぶとすぐ保存する
export function DisplaySettingsForm() {
  const [shown, setShown] = useState<boolean>()
  const [error, setError] = useState<'load' | 'save'>()
  /** 保存した回数。前の保存の失敗が後から届いても、最新の保存でなければ表示しない */
  const saveCount = useRef(0)

  useEffect(() => {
    let active = true
    getExampleTextShown()
      // 読めなかったときは初期値を出しておく（選び直せば保存できる）
      .catch((e: unknown) => {
        console.error(e)
        if (active) setError('load')
        return false
      })
      .then((loaded) => {
        if (active) setShown(loaded)
      })
    return () => {
      active = false
    }
  }, [])

  if (shown === undefined) return null

  function change(next: boolean) {
    setShown(next)
    setError(undefined)
    saveCount.current += 1
    const current = saveCount.current
    saveExampleTextShown(next).catch((e: unknown) => {
      console.error(e)
      if (current === saveCount.current) setError('save')
    })
  }

  return (
    <div className={styles.form}>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={shown}
          onChange={(e) => change(e.target.checked)}
        />
        例文の音声 → 解説で、例文を最初から表示する
      </label>
      <p className={styles.note}>
        オフのときは、表面の「例文を表示」ボタンを押すと、該当語を空欄にした英文が出ます。
      </p>
      {error && (
        <p className={styles.error} role="alert">
          {error === 'load'
            ? '設定を読み込めなかったため、初期値を表示しています。選び直すと保存します。'
            : '設定を保存できませんでした。もう一度選び直してください。'}
        </p>
      )}
    </div>
  )
}
