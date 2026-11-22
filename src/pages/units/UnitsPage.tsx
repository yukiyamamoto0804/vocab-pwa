import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { LinkList } from '../../components/LinkList'
import { LoadError } from '../../components/LoadError'
import { getPack, listUnitSummaries } from '../../db/content'
import {
  getLastFace,
  getLastTest,
  getLastUnitStudy,
  saveLastFace,
} from '../../db/settings'
import type { Face } from '../../db/types'
import { DEFAULT_FACE, isAvailableFace } from '../../features/cards/faces'
import { buildStudyQuery } from '../../features/session/studyQuery'
import { defaultTestRange } from '../../features/session/testItems'
import { useAsync } from '../../lib/useAsync'
import { ReviewSheet } from './ReviewSheet'
import { FaceField } from './SheetControls'
import { TestSheet } from './TestSheet'
import styles from './UnitsPage.module.css'
import { unitLabel } from './unitLabel'

export function UnitsPage() {
  const { packId = '' } = useParams()
  const data = useAsync(
    () =>
      Promise.all([
        getPack(packId),
        listUnitSummaries(packId),
        getLastTest(packId),
        getLastUnitStudy(packId),
        getLastFace(),
      ]),
    [packId],
  )
  const [testOpen, setTestOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  /** 選び直した表面の種類。選び直すまでは前回選んだもの（data の lastFace）を使う */
  const [chosenFace, setChosenFace] = useState<Face>()

  if (data.status === 'loading') return null
  if (data.status === 'error') return <LoadError />
  const [pack, units, lastTest, lastUnitStudy, lastFace] = data.value
  // 前回選んだ表面が今は選べない（保存した後に作り直した、など）ときは、初回と同じ表面にする
  const face =
    chosenFace ??
    (lastFace && isAvailableFace(lastFace) ? lastFace : DEFAULT_FACE)

  function chooseFace(next: Face) {
    setChosenFace(next)
    // 次に開いたときの初期値に使うだけなので、保存に失敗しても選んだ表面で続ける
    saveLastFace(next).catch((e: unknown) => console.error(e))
  }
  if (!pack) {
    return (
      <>
        <p>教材パックが見つかりません。</p>
        <Link to="/">ホームへ戻る</Link>
      </>
    )
  }

  const testRange = defaultTestRange(
    units.map(({ unit, learnedCount }) => ({ id: unit.id, learnedCount })),
    lastTest,
  )

  return (
    <>
      <Link to="/">← 教材パック</Link>
      <div className={styles.header}>
        <h1>{pack.manifest.title}</h1>
        {/* ユニットがない（単語がない）パックでは、復習もテストもできない */}
        {testRange && (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              onClick={() => setReviewOpen(true)}
            >
              復習
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => setTestOpen(true)}
            >
              テスト
            </button>
          </div>
        )}
      </div>
      <div className={styles.faces}>
        <FaceField value={face} onChange={chooseFace} />
      </div>
      <LinkList
        items={units.map(({ unit, itemCount, learnedCount }) => ({
          key: String(unit.id),
          to: `/packs/${encodeURIComponent(packId)}/units/${unit.id}`,
          title: unitLabel(unit),
          meta: `${itemCount} 語・学習済み ${learnedCount} 語`,
          badge: unit.id === lastUnitStudy?.unitId ? '前回' : undefined,
          action: {
            to: `/study?${buildStudyQuery({
              mode: 'unit',
              packId,
              face,
              unitId: unit.id,
            })}`,
            label: '学習',
          },
        }))}
      />
      {reviewOpen && (
        <ReviewSheet
          onClose={() => setReviewOpen(false)}
          packId={packId}
          face={face}
        />
      )}
      {testRange && testOpen && (
        <TestSheet
          onClose={() => setTestOpen(false)}
          packId={packId}
          face={face}
          units={units}
          initialRange={testRange}
        />
      )}
    </>
  )
}
