import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import type { Face } from '../../db/types'
import { noFaceDataMessage, skippedNotice } from '../../features/cards/faces'
import { loadReviewItems } from '../../features/session/forgottenItems'
import {
  countAfterTake,
  type StudyCount,
} from '../../features/session/studyCount'
import { buildStudyQuery } from '../../features/session/studyQuery'
import { studyConfig } from '../../features/studyConfig'
import { useAsync } from '../../lib/useAsync'
import { CountField } from './SheetControls'
import styles from './StudySheet.module.css'

interface Props {
  /** 閉じられたとき（✕・背景・Esc）に呼ぶ */
  onClose: () => void
  packId: string
  /** ユニット一覧で選んでいる表面の種類 */
  face: Face
}

const { min, max, default: defaultRange } = studyConfig.reviewSessionRange
const RANGE_OPTIONS = Array.from({ length: max - min + 1 }, (_, i) => min + i)

// 復習の条件を選ぶシート（docs/specs/study-cards.md 6 章「復習」）。
// 開いている間だけ置き、開くたびに対象範囲を初期値に戻して語数を数え直す
export function ReviewSheet({ onClose, packId, face }: Props) {
  const navigate = useNavigate()
  const [sessionCount, setSessionCount] = useState<number>(defaultRange)
  const [count, setCount] = useState<StudyCount>(
    studyConfig.reviewCount.default,
  )
  /** 対象範囲で忘れた単語の数 */
  const total = useAsync(async () => {
    const { items, skippedCount } = await loadReviewItems(
      packId,
      sessionCount,
      face,
    )
    return { count: items.length, skippedCount }
  }, [packId, sessionCount, face])

  const notice =
    total.status === 'done'
      ? skippedNotice(total.value.skippedCount, face)
      : undefined

  function start() {
    navigate(
      `/study?${buildStudyQuery({ mode: 'review', packId, face, sessionCount, count })}`,
    )
  }

  return (
    <BottomSheet onClose={onClose} title="復習">
      <label className={styles.select}>
        <span>対象範囲</span>
        <select
          value={sessionCount}
          onChange={(e) => setSessionCount(Number(e.target.value))}
        >
          {RANGE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              直前 {n} 回の学習
            </option>
          ))}
        </select>
      </label>

      <CountField name="review-count" value={count} onChange={setCount} />

      <p className={styles.summary} aria-live="polite">
        {total.status === 'loading'
          ? '対象の単語を数えています…'
          : total.status === 'error'
            ? '対象の単語を読み込めませんでした。閉じてから開き直してください。'
            : total.value.count > 0
              ? `${countAfterTake(total.value.count, count)} 語を出題します（この範囲で忘れたままの単語 ${total.value.count} 語）`
              : total.value.skippedCount > 0
                ? noFaceDataMessage(face)
                : 'この範囲に忘れたままの単語はありません。範囲を広げてください。'}
      </p>
      {/* 対象が 0 語のときは、上の文で表面を変えるよう伝えているので出さない */}
      {notice && total.status === 'done' && total.value.count > 0 && (
        <p className={styles.notice}>{notice}</p>
      )}

      <button
        type="button"
        className={styles.start}
        onClick={start}
        disabled={total.status !== 'done' || total.value.count === 0}
      >
        開始
      </button>
    </BottomSheet>
  )
}
