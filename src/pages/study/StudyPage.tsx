import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '../../components/LoadError'
import { Loading } from '../../components/Loading'
import { getProgressMap, getUnit, listUnitItems } from '../../db/content'
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
  firstAnswerSettingsOf,
  loadResumable,
  type Resumable,
  studyKeyOf,
} from '../../features/session/inProgress'
import {
  parseStudyQuery,
  type ReviewQuery,
  type StudyQuery,
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
import { RETURN_FROM_STUDY } from './returnFromStudy'
import styles from './StudyPage.module.css'
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
  // 条件が変わったら、途中の学習を調べ直し、選んだ内容も持ち越さない
  return <ResumeGate key={studyKeyOf(query)} query={query} />
}

/** 途中の学習があれば「続きから」と「最初から」を選んでもらい、選んだ方で学習を始める（study-cards.md 5 章） */
function ResumeGate({ query }: { query: StudyQuery }) {
  const resumable = useAsync(() => loadResumable(query), [])
  const [choice, setChoice] = useState<'resume' | 'restart'>()

  if (resumable.status === 'loading') return <Loading />
  // 途中の学習を調べられなくても、最初から始められるようにする。1 問答えると途中の学習が消えることを伝えてから選んでもらう
  if (resumable.status === 'error' && choice === undefined) {
    return (
      <div className={styles.resume}>
        <h1>途中の学習を読み込めませんでした</h1>
        <p>
          最初から始められます。最初から始めて 1
          問答えると、途中の学習は消えます。アプリを開き直すと、読み込めることがあります。
        </p>
        <button
          type="button"
          className={styles.primary}
          onClick={() => setChoice('restart')}
        >
          最初から
        </button>
        <Link
          to={`/packs/${encodeURIComponent(query.packId)}`}
          replace
          state={RETURN_FROM_STUDY}
        >
          ← ユニット一覧
        </Link>
      </div>
    )
  }
  const found = resumable.status === 'done' ? resumable.value : undefined
  if (found && choice === undefined) {
    const { deck } = found
    return (
      <div className={styles.resume}>
        <h1>途中の学習があります</h1>
        <p>
          前回は {deck.position} / {deck.queue.length}{' '}
          問まで答えたところでやめています。
        </p>
        <button
          type="button"
          className={styles.primary}
          onClick={() => setChoice('resume')}
        >
          続きから
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => setChoice('restart')}
        >
          最初から
        </button>
        <Link
          to={`/packs/${encodeURIComponent(query.packId)}`}
          replace
          state={RETURN_FROM_STUDY}
        >
          ← ユニット一覧
        </Link>
      </div>
    )
  }
  if (found && choice === 'resume')
    return <ResumedStudy query={query} resumable={found} />
  switch (query.mode) {
    case 'unit':
      return <UnitStudy query={query} />
    case 'test':
      return <TestStudy query={query} />
    case 'review':
      return <ReviewStudy query={query} />
  }
}

function ResumedStudy({
  query,
  resumable,
}: {
  query: StudyQuery
  resumable: Resumable
}) {
  const reported = useAsync(() => listReportedItemIds(query.packId), [])
  if (reported.status === 'loading') return <Loading />
  if (reported.status === 'error') return <LoadError />
  return (
    <StudySession
      packId={query.packId}
      mode={query.mode}
      face={query.face}
      items={resumable.items}
      initialProgress={resumable.progress}
      initialReported={reported.value}
      exitPath={`/packs/${encodeURIComponent(query.packId)}`}
      studyKey={studyKeyOf(query)}
      firstAnswerSettings={firstAnswerSettingsOf(query)}
      resume={resumable}
    />
  )
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

  const unitsPath = `/packs/${encodeURIComponent(packId)}`
  if (data.status === 'loading') return <Loading />
  if (data.status === 'error') return <LoadError />
  const { unit, allUnitItemCount, unitItemCount, items, progress, reported } =
    data.value
  if (!unit || allUnitItemCount === 0) {
    return (
      <>
        <p>ユニットが見つからないか、単語がありません。</p>
        <Link to={unitsPath} state={RETURN_FROM_STUDY}>
          ← ユニット一覧
        </Link>
      </>
    )
  }
  if (unitItemCount === 0) {
    return (
      <>
        <h1>学習</h1>
        <p>{noFaceDataMessage(face)}</p>
        <Link to={unitsPath} state={RETURN_FROM_STUDY}>
          ← ユニット一覧
        </Link>
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
      studyKey={studyKeyOf(query)}
      firstAnswerSettings={firstAnswerSettingsOf(query)}
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
        <Link to={unitsPath} state={RETURN_FROM_STUDY}>
          ← ユニット一覧
        </Link>
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
      studyKey={studyKeyOf(query)}
      firstAnswerSettings={firstAnswerSettingsOf(query)}
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
        <Link to={unitsPath} state={RETURN_FROM_STUDY}>
          ← ユニット一覧
        </Link>
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
      studyKey={studyKeyOf(query)}
      notice={skippedNotice(skippedCount, face)}
    />
  )
}
