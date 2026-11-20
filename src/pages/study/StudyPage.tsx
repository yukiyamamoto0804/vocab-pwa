import { Link, useSearchParams } from 'react-router'
import { LoadError } from '../../components/LoadError'
import { getProgressMap, getUnit, listUnitItems } from '../../db/content'
import { listReportedItemIds } from '../../db/study'
import {
  parseStudyQuery,
  type StudyQuery,
} from '../../features/session/studyQuery'
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
  // テスト（手順 7）とほかの表面（手順 8）はまだない
  if (query.mode !== 'unit' || query.face !== 'en') {
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
  return <UnitStudy query={query} />
}

function UnitStudy({ query }: { query: StudyQuery }) {
  const { packId } = query
  const unitId = query.unitIds[0]
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
    return { unit, items, progress, reported }
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
      face={query.face}
      items={items}
      initialProgress={progress}
      initialReported={reported}
      exitPath={unitsPath}
    />
  )
}
