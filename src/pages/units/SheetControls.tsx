import type { Face } from '../../db/types'
import { FACE_LABELS, FACE_OPTIONS } from '../../features/cards/faces'
import type { StudyCount } from '../../features/session/studyCount'
import { studyConfig } from '../../features/studyConfig'
import styles from './StudySheet.module.css'

// ユニット一覧（表面の種類）とテスト・復習のシートで共通の入力部品

/** ラジオボタンを、押しやすいボタンの形で出す */
export function Choice(props: {
  name: string
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className={styles.choice}>
      <input
        type="radio"
        name={props.name}
        checked={props.checked}
        onChange={props.onChange}
      />
      {props.label}
    </label>
  )
}

/** 出題数（20 / 50 / 100 / すべて）の選択肢 */
export function CountField(props: {
  name: string
  value: StudyCount
  onChange: (count: StudyCount) => void
}) {
  return (
    <fieldset className={styles.field}>
      <legend>出題数</legend>
      <div className={styles.choices}>
        {studyConfig.studyCount.options.map((option) => (
          <Choice
            key={option}
            name={props.name}
            label={option === 'all' ? 'すべて' : String(option)}
            checked={props.value === option}
            onChange={() => props.onChange(option)}
          />
        ))}
      </div>
    </fieldset>
  )
}

/** 表面の種類の選択肢（作り終えた表面だけ） */
export function FaceField(props: {
  value: Face
  onChange: (face: Face) => void
}) {
  return (
    <fieldset className={styles.field}>
      <legend>表面</legend>
      <div className={styles.choices}>
        {FACE_OPTIONS.map((option) => (
          <Choice
            key={option}
            name="face"
            label={FACE_LABELS[option]}
            checked={props.value === option}
            onChange={() => props.onChange(option)}
          />
        ))}
      </div>
    </fieldset>
  )
}
