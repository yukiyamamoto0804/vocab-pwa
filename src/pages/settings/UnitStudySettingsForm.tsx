import { useEffect, useRef, useState } from 'react'
import {
  saveUnitStudySettings,
  type UnitStudySettings,
} from '../../db/settings'
import {
  loadUnitStudySettings,
  normalizeUnitStudySettings,
} from '../../features/session/unitStudySettings'
import { studyConfig } from '../../features/studyConfig'
import styles from './UnitStudySettingsForm.module.css'

/** min〜max の整数の一覧 */
const range = ({ min, max }: { min: number; max: number }) =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i)

// ユニット学習の共通の設定（docs/specs/study-cards.md 7 章）。選ぶとすぐ保存する
export function UnitStudySettingsForm() {
  const [settings, setSettings] = useState<UnitStudySettings>()
  const [error, setError] = useState<'load' | 'save'>()
  /** 保存した回数。前の保存の失敗が後から届いても、最新の保存でなければ表示しない */
  const saveCount = useRef(0)

  useEffect(() => {
    let active = true
    loadUnitStudySettings()
      // 読めなかったときは初期値を出しておく（選び直せば保存できる）
      .catch((e: unknown) => {
        console.error(e)
        if (active) setError('load')
        return normalizeUnitStudySettings(undefined)
      })
      .then((loaded) => {
        if (active) setSettings(loaded)
      })
    return () => {
      active = false
    }
  }, [])

  if (!settings) return null

  function change(next: UnitStudySettings) {
    setSettings(next)
    setError(undefined)
    saveCount.current += 1
    const current = saveCount.current
    saveUnitStudySettings(next).catch((e: unknown) => {
      console.error(e)
      if (current === saveCount.current) setError('save')
    })
  }

  return (
    <div className={styles.form}>
      <label className={styles.row}>
        <span>混ぜる単語の数（上限）</span>
        <select
          value={settings.mixCount}
          onChange={(e) =>
            change({ ...settings, mixCount: Number(e.target.value) })
          }
        >
          {range(studyConfig.mixCount).map((n) => (
            <option key={n} value={n}>
              {n === 0 ? '混ぜない' : `${n} 語`}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.row}>
        <span>混ぜる単語の対象範囲</span>
        <select
          value={settings.mixSessionRange}
          disabled={settings.mixCount === 0}
          onChange={(e) =>
            change({ ...settings, mixSessionRange: Number(e.target.value) })
          }
        >
          {range(studyConfig.mixSessionRange).map((n) => (
            <option key={n} value={n}>
              直前 {n} 回の学習
            </option>
          ))}
        </select>
      </label>
      <p className={styles.note}>
        ユニット学習で、直前の何回かのユニット学習・テスト（その間の復習も含めて判定）で「忘れた」と答え、その後「覚えた」と答えていない単語を混ぜて出します。回数に復習は数えません。上限より多いときは、その中からランダムに選びます。
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
