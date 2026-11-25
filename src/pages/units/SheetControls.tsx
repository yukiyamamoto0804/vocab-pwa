import type { Face } from '../../db/types'
import { FACE_LABELS } from '../../features/cards/faces'
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
      <span className={styles.choiceLabel}>
        {/* 幅が足りないときは「（」の前で改行し、語の途中で切れないようにする（例: 単語の音声 / （自動）） */}
        {props.label.split(/(?=（)/).map((part, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 文言を区切っただけで、並びは変わらない
          <span key={i} className={styles.nowrap}>
            {part}
          </span>
        ))}
      </span>
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

/**
 * 表面の種類の選択肢の並び（1 行目: 単語を出す表面、2 行目: 例文を使う表面。study-cards.md 7 章）。
 * 自動で進める学習（study-cards.md 11 章）は、使う場面が違うため、「単語の音声」とは別の選択肢にする
 */
const FACE_ROWS: readonly (readonly Face[])[] = [
  ['en', 'word-audio', 'word-audio-auto'],
  ['ja', 'example-audio'],
]

/** 表面の種類の選択肢（作り終えた表面だけ） */
export function FaceField(props: {
  value: Face
  onChange: (face: Face) => void
}) {
  return (
    <fieldset className={styles.field}>
      <legend>表面</legend>
      <div className={styles.rows}>
        {FACE_ROWS.map((row) => (
          <div key={row[0]} className={styles.choices}>
            {row.map((option) => (
              <Choice
                key={option}
                name="face"
                label={FACE_LABELS[option]}
                checked={props.value === option}
                onChange={() => props.onChange(option)}
              />
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  )
}
