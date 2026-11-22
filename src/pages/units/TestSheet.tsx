import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import type { UnitSummary } from '../../db/content'
import type { TestOrder } from '../../db/types'
import type { StudyCount } from '../../features/session/studyCount'
import { buildStudyQuery } from '../../features/session/studyQuery'
import { countTestItems } from '../../features/session/testItems'
import { studyConfig } from '../../features/studyConfig'
import { Choice, CountField } from './SheetControls'
import styles from './StudySheet.module.css'
import { unitLabel } from './unitLabel'

interface Props {
  /** 閉じられたとき（✕・背景・Esc）に呼ぶ */
  onClose: () => void
  packId: string
  /** 番号順のユニット */
  units: UnitSummary[]
  initialRange: { fromUnit: number; toUnit: number }
}

const ORDER_LABELS: Record<TestOrder, string> = {
  weak: '苦手優先',
  random: 'ランダム',
}

// テストの条件を選ぶシート（docs/specs/study-cards.md 6 章「テストの範囲と出題数」）。
// 開いている間だけ置き、開くたびに条件を最初の値に戻す
export function TestSheet({ onClose, packId, units, initialRange }: Props) {
  const navigate = useNavigate()

  const [fromUnit, setFromUnit] = useState(initialRange.fromUnit)
  const [toUnit, setToUnit] = useState(initialRange.toUnit)
  const [count, setCount] = useState<StudyCount>(studyConfig.testCount.default)
  const [includeUnlearned, setIncludeUnlearned] = useState(false)
  const [order, setOrder] = useState<TestOrder>(studyConfig.testOrder.default)

  const inRange = units.filter(
    ({ unit }) => unit.id >= fromUnit && unit.id <= toUnit,
  )
  const learned = inRange.reduce((sum, u) => sum + u.learnedCount, 0)
  const total = inRange.reduce((sum, u) => sum + u.itemCount, 0)
  const selected = countTestItems(learned, total, { count, includeUnlearned })

  // 開始が終了より後ろにならないよう、片方を変えたらもう片方を合わせる
  function changeFrom(id: number) {
    setFromUnit(id)
    if (id > toUnit) setToUnit(id)
  }
  function changeTo(id: number) {
    setToUnit(id)
    if (id < fromUnit) setFromUnit(id)
  }

  function start() {
    navigate(
      `/study?${buildStudyQuery({
        mode: 'test',
        packId,
        face: 'en',
        fromUnit,
        toUnit,
        count,
        includeUnlearned,
        order,
      })}`,
    )
  }

  return (
    <BottomSheet onClose={onClose} title="テスト">
      <fieldset className={styles.field}>
        <legend>範囲</legend>
        <div className={styles.range}>
          <UnitSelect
            label="開始"
            units={units}
            value={fromUnit}
            onChange={changeFrom}
          />
          <span aria-hidden="true">〜</span>
          <UnitSelect
            label="終了"
            units={units}
            value={toUnit}
            onChange={changeTo}
          />
        </div>
      </fieldset>

      <CountField name="test-count" value={count} onChange={setCount} />

      <fieldset className={styles.field}>
        <legend>並び順</legend>
        <div className={styles.choices}>
          {(['weak', 'random'] as const).map((option) => (
            <Choice
              key={option}
              name="test-order"
              label={ORDER_LABELS[option]}
              checked={order === option}
              onChange={() => setOrder(option)}
            />
          ))}
        </div>
      </fieldset>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={includeUnlearned}
          onChange={(e) => setIncludeUnlearned(e.target.checked)}
        />
        未学習の語も含める
      </label>

      <p className={styles.summary} aria-live="polite">
        {selected > 0
          ? `${selected} 語を出題します（範囲の学習済み ${learned} 語・全 ${total} 語）`
          : includeUnlearned
            ? '範囲に単語がありません。範囲を変えてください。'
            : '範囲に学習済みの単語がありません。範囲を変えるか、「未学習の語も含める」を選んでください。'}
      </p>

      <button
        type="button"
        className={styles.start}
        onClick={start}
        disabled={selected === 0}
      >
        開始
      </button>
    </BottomSheet>
  )
}

function UnitSelect(props: {
  label: string
  units: UnitSummary[]
  value: number
  onChange: (id: number) => void
}) {
  return (
    <label className={styles.select}>
      <span>{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      >
        {props.units.map(({ unit }) => (
          <option key={unit.id} value={unit.id}>
            {unitLabel(unit)}
          </option>
        ))}
      </select>
    </label>
  )
}
