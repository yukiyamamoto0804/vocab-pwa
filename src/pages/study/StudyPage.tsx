import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '../../components/LoadError'
import { Loading } from '../../components/Loading'
import { getProgressMap, getUnit, listUnitItems } from '../../db/content'
import { saveLastTest, saveLastUnitStudy } from '../../db/settings'
import { listReportedItemIds } from '../../db/study'
import {
  hasFaceData,
  noFaceDataMessage,
  skippedNotice,
} from '../../features/cards/faces'
import {
  loadMixItems,
  loadReviewItems,
  selectReviewItems,
} from '../../features/session/forgottenItems'
import {
  parseStudyQuery,
  type ReviewQuery,
  type TestQuery,
  type UnitQuery,
} from '../../features/session/studyQuery'
import {
  loadTestCandidates,
  selectTestItems,
  skippedTestCount,
} from '../../features/session/testItems'
import { shuffle } from '../../lib/random'
import { useAsync } from '../../lib/useAsync'
import { StudySession } from './StudySession'

export function StudyPage() {
  const [params] = useSearchParams()
  const query = parseStudyQuery(params)

  if (!query) {
    return (
      <>
        <h1>学習</h1>
        <p>学習の条件が正しくありません。</p>
        <Link to="/">ホームへ戻る</Link>
      </>
    )
  }
  switch (query.mode) {
    case 'unit':
      return <UnitStudy query={query} />
    case 'test':
      return <TestStudy query={query} />
    case 'review':
      return <ReviewStudy query={query} />
  }
}

function UnitStudy({ query }: { query: UnitQuery }) {
  const { packId, unitId, face } = query
  // 出す単語は読み込むときに 1 回だけ選ぶ（描画のたびに選び直さない）
  const data = useAsync(async () => {
    const [unit, allUnitItems, reported] = await Promise.all([
      getUnit(packId, unitId),
      listUnitItems(packId, unitId),
      listReportedItemIds(packId),
    ])
    // 表面に必要なデータがない単語は出題しない
    const unitItems = allUnitItems.filter((item) => hasFaceData(item, face))
    // 混ぜる単語は補助的なものなので、読み込めなくても混ぜずに学習を始める
    const mixed = await loadMixItems(
      packId,
      new Set(unitItems.map((i) => i.id)),
      face,
    ).catch((e: unknown) => {
      console.error(e)
      return []
    })
    const progress = await getProgressMap(
      packId,
      [...unitItems, ...mixed].map((i) => i.id),
    )
    // 並び順で覚えてしまうのを防ぐため、混ぜた単語も含めてランダムに並べて出す
    return {
      unit,
      allUnitItemCount: allUnitItems.length,
      unitItemCount: unitItems.length,
      items: shuffle([...unitItems, ...mixed]),
      progress,
      reported,
    }
  }, [packId, unitId, face])
  // 最初の回答を保存できたら、学習したものとして日時とユニットを残す
  const handleAnswered = useOnFirstAnswer(() =>
    saveLastUnitStudy(packId, { at: Date.now(), unitId }),
  )

  const unitsPath = `/packs/${encodeURIComponent(packId)}`
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') return <LoadError />
  const { unit, allUnitItemCount, unitItemCount, items, progress, reported } =
    data.value
  if (!unit || allUnitItemCount === 0) {
    return (
      <>
        <p>ユニットが見つからないか、単語がありません。</p>
        <Link to={unitsPath}>← ユニット一覧</Link>
      </>
    )
  }
  if (unitItemCount === 0) {
    return (
      <>
        <h1>学習</h1>
        <p>{noFaceDataMessage(face)}</p>
        <Link to={unitsPath}>← ユニット一覧</Link>
      </>
    )
  }
  return (
    <StudySession
      packId={packId}
      mode="unit"
      face={query.face}
      items={items}
      initialProgress={progress}
      initialReported={reported}
      exitPath={unitsPath}
      onAnswered={handleAnswered}
      notice={skippedNotice(allUnitItemCount - unitItemCount, face)}
    />
  )
}

function TestStudy({ query }: { query: TestQuery }) {
  const { packId, face, fromUnit, toUnit, count, includeUnlearned, order } =
    query
  // 出す単語は読み込むときに 1 回だけ選ぶ（描画のたびに選び直さない）
  const data = useAsync(async () => {
    // 表面に必要なデータがない単語は、選ぶ前に除く（選んだ後に除くと出題数より少なくなるため）
    const [candidates, reported] = await Promise.all([
      loadTestCandidates(packId, fromUnit, toUnit, face),
      listReportedItemIds(packId),
    ])
    const { items, progress } = candidates
    // 表面に必要なデータがなくて出せない単語の数（出題の候補の中で数える）。
    // テストは範囲の全部を出すものではないので知らせず、出せる単語が 1 つもないときの理由にだけ使う
    const skippedCount = skippedTestCount(candidates, includeUnlearned)
    const selected = selectTestItems(items, progress, {
      count,
      includeUnlearned,
      order,
    })
    return { items: selected, progress, reported, skippedCount }
  }, [packId, face, fromUnit, toUnit, count, includeUnlearned, order])
  // 最初の回答を保存できたら、テストしたものとして日時と範囲を残す
  const handleAnswered = useOnFirstAnswer(() =>
    saveLastTest(packId, { at: Date.now(), fromUnit, toUnit }),
  )

  const unitsPath = `/packs/${encodeURIComponent(packId)}`
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') return <LoadError />
  const { items, progress, reported, skippedCount } = data.value
  if (items.length === 0) {
    return (
      <>
        <h1>学習</h1>
        <p>
          {skippedCount > 0
            ? noFaceDataMessage(face)
            : '範囲に出題できる単語がありません。'}
        </p>
        <Link to={unitsPath}>← ユニット一覧</Link>
      </>
    )
  }

  return (
    <StudySession
      packId={packId}
      mode="test"
      face={query.face}
      items={items}
      initialProgress={progress}
      initialReported={reported}
      exitPath={unitsPath}
      onAnswered={handleAnswered}
    />
  )
}

function ReviewStudy({ query }: { query: ReviewQuery }) {
  const { packId, face, sessionCount, count } = query
  // 出す単語は読み込むときに 1 回だけ選ぶ（回答するたびに記録が増えて対象が変わるため）
  const data = useAsync(async () => {
    const [{ items, skippedCount }, reported] = await Promise.all([
      loadReviewItems(packId, sessionCount, face),
      listReportedItemIds(packId),
    ])
    const selected = selectReviewItems(items, count)
    const progress = await getProgressMap(
      packId,
      selected.map((i) => i.id),
    )
    return { items: selected, progress, reported, skippedCount }
  }, [packId, face, sessionCount, count])

  const unitsPath = `/packs/${encodeURIComponent(packId)}`
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') return <LoadError />
  const { items, progress, reported, skippedCount } = data.value
  if (items.length === 0) {
    return (
      <>
        <h1>学習</h1>
        <p>
          {skippedCount > 0
            ? noFaceDataMessage(face)
            : `直前 ${sessionCount} 回の学習に、忘れたままの単語はありません。`}
        </p>
        <Link to={unitsPath}>← ユニット一覧</Link>
      </>
    )
  }

  return (
    <StudySession
      packId={packId}
      mode="review"
      face={query.face}
      items={items}
      initialProgress={progress}
      initialReported={reported}
      exitPath={unitsPath}
      notice={skippedNotice(skippedCount, face)}
    />
  )
}

/**
 * 最初の回答を保存できたときに 1 回だけ save を呼ぶ、回答ごとの処理を返す。
 * 保存するのは次の学習の初期値や表示に使う値なので、失敗しても学習は続け、次の回答でやり直す
 */
function useOnFirstAnswer(save: () => Promise<void>): () => void {
  const saved = useRef(false)
  return () => {
    if (saved.current) return
    saved.current = true
    save().catch((e: unknown) => {
      console.error(e)
      saved.current = false
    })
  }
}
