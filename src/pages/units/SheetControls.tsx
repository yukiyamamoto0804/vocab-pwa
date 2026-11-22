import type { StudyCount } from '../../features/session/studyCount'
import { studyConfig } from '../../features/studyConfig'
import styles from './StudySheet.module.css'

// テスト・復習のシートで共通の入力部品

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
