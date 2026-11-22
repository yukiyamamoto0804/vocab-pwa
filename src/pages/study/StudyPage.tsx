import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { LoadError } from '../../components/LoadError'
import {
  getProgressMap,
  getUnit,
  listItemsInUnits,
  listUnitItems,
} from '../../db/content'
import { saveLastTest } from '../../db/settings'
import { listReportedItemIds } from '../../db/study'
import {
  parseStudyQuery,
  type TestQuery,
  type UnitQuery,
} from '../../features/session/studyQuery'
import { selectTestItems } from '../../features/session/testItems'
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
  // ほかの表面（手順 8）はまだない
  if (query.face !== 'en') {
    return (
      <>
        <h1>学習</h1>
        <p>この学習の方法は準備中です。</p>
        <Link to={`/packs/${encodeURIComponent(query.packId)}`}>
          ← ユニット一覧
        </Link>
      </>
    )
  }
  return query.mode === 'unit' ? (
    <UnitStudy query={query} />
  ) : (
    <TestStudy query={query} />
  )
}

function UnitStudy({ query }: { query: UnitQuery }) {
  const { packId, unitId } = query
  const data = useAsync(async () => {
    const [unit, items, reported] = await Promise.all([
      getUnit(packId, unitId),
      listUnitItems(packId, unitId),
      listReportedItemIds(packId),
    ])
    const progress = await getProgressMap(
      packId,
      items.map((i) => i.id),
    )
    // 並び順で覚えてしまうのを防ぐため、ランダムに並べて出す
    return { unit, items: shuffle(items), progress, reported }
  }, [packId, unitId])

  const unitsPath = `/packs/${encodeURIComponent(packId)}`
  if (data.status === 'loading') return null
  if (data.status === 'error') return <LoadError />
  const { unit, items, progress, reported } = data.value
  if (!unit || items.length === 0) {
    return (
      <>
        <p>ユニットが見つからないか、単語がありません。</p>
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
    />
  )
}

function TestStudy({ query }: { query: TestQuery }) {
  const { packId, fromUnit, toUnit, count, includeUnlearned, order } = query
  // 出す単語は読み込むときに 1 回だけ選ぶ（描画のたびに選び直さない）
  const data = useAsync(async () => {
    const [items, reported] = await Promise.all([
      listItemsInUnits(packId, fromUnit, toUnit),
      listReportedItemIds(packId),
    ])
    const progress = await getProgressMap(
      packId,
      items.map((i) => i.id),
    )
    // 手順 8 で表面の種類を増やしたら、必要なデータがない単語はここで（選ぶ前に）除く。
    // 選んだ後に除くと出題数より少なくなり、シートに出した語数ともずれるため
    const selected = selectTestItems(items, progress, {
      count,
      includeUnlearned,
      order,
    })
    return { items: selected, progress, reported }
  }, [packId, fromUnit, toUnit, count, includeUnlearned, order])
  const savedLastTest = useRef(false)

  const unitsPath = `/packs/${encodeURIComponent(packId)}`
  if (data.status === 'loading') return null
  if (data.status === 'error') return <LoadError />
  const { items, progress, reported } = data.value
  if (items.length === 0) {
    return (
      <>
        <h1>学習</h1>
        <p>範囲に出題できる単語がありません。</p>
        <Link to={unitsPath}>← ユニット一覧</Link>
      </>
    )
  }

  // 最初の回答を保存できたら、テストしたものとして日時と範囲を残す
  function handleAnswered() {
    if (savedLastTest.current) return
    savedLastTest.current = true
    saveLastTest(packId, { at: Date.now(), fromUnit, toUnit }).catch(
      (e: unknown) => {
        // 次のテストの初期値に使うだけなので、失敗しても学習は続ける
        console.error(e)
        savedLastTest.current = false
      },
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
