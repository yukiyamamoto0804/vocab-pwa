import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { LinkList } from '../../components/LinkList'
import { LoadError } from '../../components/LoadError'
import { Loading } from '../../components/Loading'
import { PackCredits } from '../../components/PackCredits'
import { getPack, listUnitSummaries } from '../../db/content'
import {
  getLastFace,
  getLastTest,
  getLastUnitStudy,
  saveLastFace,
} from '../../db/settings'
import type { Face } from '../../db/types'
import { DEFAULT_FACE } from '../../features/cards/faces'
import { buildStudyQuery } from '../../features/session/studyQuery'
import { defaultTestRange } from '../../features/session/testItems'
import { isReturnToUnits } from '../../lib/returnToUnits'
import { useAsync } from '../../lib/useAsync'
import { ReviewSheet } from './ReviewSheet'
import { FaceField } from './SheetControls'
import { TestSheet } from './TestSheet'
import styles from './UnitsPage.module.css'
import { unitLabel } from './unitLabel'
import { rememberUnitRow, takeUnitRow } from './unitRowPosition'

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
  const listRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  /** 学習画面・単語一覧から戻ってきたか */
  const returned = isReturnToUnits(location.state)

  // 学習画面・単語一覧から戻ったら、行を押したときと同じ高さにそのユニットの行が来るようにスクロールする
  // （続けて次のユニットを選びやすいように。study-cards.md 6 章）。描画の前に合わせ、一瞬上から見えないようにする
  useLayoutEffect(() => {
    if (data.status !== 'done') return
    // ほかの経路で開いたときも覚えた位置は取り出して忘れ、使わない
    const position = takeUnitRow(packId)
    if (!returned) return
    const row =
      position &&
      listRef.current?.querySelector<HTMLElement>(
        `[data-key="${position.unitId}"]`,
      )
    if (position && row)
      window.scrollTo({
        top: window.scrollY + row.getBoundingClientRect().top - position.top,
      })
    // 印は履歴の項目に残るので、使ったら消す。
    // 残すと、この一覧へブラウザの戻る操作で戻ったときにも、後で覚えた位置へ飛んでしまう
    navigate(location.pathname, { replace: true, state: null })
  }, [data.status, packId, returned, navigate, location.pathname])

  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') return <LoadError />
  const [pack, units, lastTest, lastUnitStudy, lastFace] = data.value
  // 前回選んだ表面がなければ（初回）、初回の表面にする
  const face = chosenFace ?? lastFace ?? DEFAULT_FACE

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

  /** 押した行の画面上の高さを覚える（戻ったときに同じ高さへスクロールするため） */
  const rememberRow = (unitId: number) => (row: HTMLElement) =>
    rememberUnitRow({ packId, unitId, top: row.getBoundingClientRect().top })

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
      <div ref={listRef}>
        <LinkList
          items={units.map(({ unit, itemCount, learnedCount }) => ({
            key: String(unit.id),
            to: `/packs/${encodeURIComponent(packId)}/units/${unit.id}`,
            title: unitLabel(unit),
            meta: `${itemCount} 語・学習済み ${learnedCount} 語`,
            badge: unit.id === lastUnitStudy?.unitId ? '前回' : undefined,
            onClick: rememberRow(unit.id),
            action: {
              to: `/study?${buildStudyQuery({
                mode: 'unit',
                packId,
                face,
                unitId: unit.id,
              })}`,
              label: '学習',
              onClick: rememberRow(unit.id),
            },
          }))}
        />
      </div>
      {/* ライセンスと出典を、取り込んだ後も確かめられるようにする（docs/specs/demo-pack.md 6 章） */}
      <details className={styles.about}>
        <summary>このパックについて</summary>
        <PackCredits
          createdAt={pack.manifest.createdAt}
          license={pack.manifest.license}
          attribution={pack.manifest.attribution}
        >
          <dt>名前</dt>
          <dd>{pack.manifest.title}</dd>
        </PackCredits>
      </details>
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
