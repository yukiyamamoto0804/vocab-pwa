import { type SyntheticEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { UnitSummary } from '../../db/content'
import type { TestOrder } from '../../db/types'
import {
  buildStudyQuery,
  type TestCount,
} from '../../features/session/studyQuery'
import { countTestItems } from '../../features/session/testItems'
import { studyConfig } from '../../features/studyConfig'
import styles from './TestSheet.module.css'
import { unitLabel } from './unitLabel'

interface Props {
  open: boolean
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
// 画面の下から出す
export function TestSheet({
  open,
  onClose,
  packId,
  units,
  initialRange,
}: Props) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  /** 押し始めた位置が背景だったか（シートの中で押し始めて背景で離したときは閉じない） */
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    dialog.showModal()
    // iOS では、背景をスワイプすると裏の一覧がスクロールしてしまうため、開いている間は止める
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
      dialog.close()
    }
  }, [open])

  const [fromUnit, setFromUnit] = useState(initialRange.fromUnit)
  const [toUnit, setToUnit] = useState(initialRange.toUnit)
  const [count, setCount] = useState<TestCount>(studyConfig.testCount.default)
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

  const close = () => dialogRef.current?.close()
  const isBackdrop = (e: SyntheticEvent) => e.target === e.currentTarget

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは Esc で閉じられる（dialog の標準の動作）
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby="test-sheet-title"
      // close イベントは後から届くため、その間に開き直していたら（開発時の StrictMode など）無視する
      onClose={() => {
        if (!dialogRef.current?.open) onClose()
      }}
      // 背景（シートの外）を押したら閉じる
      onPointerDown={(e) => {
        pressedBackdrop.current = isBackdrop(e)
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && isBackdrop(e)) close()
      }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 id="test-sheet-title">テスト</h2>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

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

        <fieldset className={styles.field}>
          <legend>出題数</legend>
          <div className={styles.choices}>
            {studyConfig.testCount.options.map((option) => (
              <Choice
                key={option}
                name="test-count"
                label={option === 'all' ? 'すべて' : String(option)}
                checked={count === option}
                onChange={() => setCount(option)}
              />
            ))}
          </div>
        </fieldset>

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
      </div>
    </dialog>
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

function Choice(props: {
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
