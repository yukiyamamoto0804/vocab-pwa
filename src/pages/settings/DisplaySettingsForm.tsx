import { useEffect, useRef, useState } from 'react'
import {
  FRONT_SENSE_CHOICES,
  type FrontSenseChoice,
  getExampleTextShown,
  getFrontSenseChoice,
  saveExampleTextShown,
  saveFrontSenseChoice,
} from '../../db/settings'
import styles from './DisplaySettingsForm.module.css'

interface DisplaySettings {
  /** 「例文の音声」で、空欄の英文を最初から表示するか（docs/specs/study-cards.md 3 章） */
  exampleTextShown: boolean
  /** 表面に例文を使う種類で、用法が複数ある単語の例文の選び方（docs/specs/study-cards.md 4 章） */
  frontSense: FrontSenseChoice
}

const FRONT_SENSE_LABELS: Record<FrontSenseChoice, string> = {
  random: 'すべての例文からランダムに選ぶ',
  first: '1 つ目の例文だけを使う',
}

// 表面の表示の設定。選ぶとすぐ保存する
export function DisplaySettingsForm() {
  const [settings, setSettings] = useState<DisplaySettings>()
  const [error, setError] = useState<'load' | 'save'>()
  /** 保存した回数。前の保存の失敗が後から届いても、最新の保存でなければ表示しない */
  const saveCount = useRef(0)

  useEffect(() => {
    let active = true
    Promise.all([getExampleTextShown(), getFrontSenseChoice()])
      .then(([exampleTextShown, frontSense]) => ({
        exampleTextShown,
        frontSense,
      }))
      // 読めなかったときは初期値を出しておく（選び直せば保存できる）
      .catch((e: unknown): DisplaySettings => {
        console.error(e)
        if (active) setError('load')
        return { exampleTextShown: false, frontSense: 'random' }
      })
      .then((loaded) => {
        if (active) setSettings(loaded)
      })
    return () => {
      active = false
    }
  }, [])

  if (settings === undefined) return null

  /**
   * 1 項目を変えて保存する。保存に失敗したら、選び直せるよう画面の値を前に戻す
   * （ラジオボタンは、選ばれている項目を押しても保存し直せないため）
   */
  function change(next: Partial<DisplaySettings>, save: () => Promise<void>) {
    if (!settings) return
    const prev = settings
    setSettings({ ...settings, ...next })
    setError(undefined)
    saveCount.current += 1
    const current = saveCount.current
    save().catch((e: unknown) => {
      console.error(e)
      if (current !== saveCount.current) return
      setSettings(prev)
      setError('save')
    })
  }

  return (
    <div className={styles.form}>
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.exampleTextShown}
          onChange={(e) => {
            const shown = e.target.checked
            change({ exampleTextShown: shown }, () =>
              saveExampleTextShown(shown),
            )
          }}
        />
        「例文の音声」で、例文を最初から表示する
      </label>
      <p className={styles.note}>
        オフのときは、表面の「例文を表示」ボタンを押すと、該当語を空欄にした英文が出ます。
      </p>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>
          「例文の訳」・「例文の音声」で使う例文（用法が複数ある単語）
        </legend>
        <div className={styles.form}>
          {FRONT_SENSE_CHOICES.map((c) => (
            <label key={c} className={styles.checkbox}>
              <input
                type="radio"
                name="front-sense"
                checked={settings.frontSense === c}
                onChange={() =>
                  change({ frontSense: c }, () => saveFrontSenseChoice(c))
                }
              />
              {FRONT_SENSE_LABELS[c]}
            </label>
          ))}
          <p className={styles.note}>
            次に始める学習から使います。1
            つ目の例文が使えない単語（例文に該当語が見つからない、例文の音声がない）では、使える例文のうち最初のものを使います。
          </p>
        </div>
      </fieldset>

      {error && (
        <p className={styles.error} role="alert">
          {error === 'load'
            ? '設定を読み込めなかったため、初期値を表示しています。選び直すと保存します。'
            : '設定を保存できませんでした。もう一度選んでください。'}
        </p>
      )}
    </div>
  )
}
