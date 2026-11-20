import { Link, useParams } from 'react-router'
import { LinkList } from '../../components/LinkList'
import { LoadError } from '../../components/LoadError'
import { getPack, listUnitSummaries } from '../../db/content'
import { useAsync } from '../../lib/useAsync'

export function UnitsPage() {
  const { packId = '' } = useParams()
  const data = useAsync(
    () => Promise.all([getPack(packId), listUnitSummaries(packId)]),
    [packId],
  )

  if (data.status === 'loading') return null
  if (data.status === 'error') return <LoadError />
  const [pack, units] = data.value
  if (!pack) {
    return (
      <>
        <p>教材パックが見つかりません。</p>
        <Link to="/">ホームへ戻る</Link>
      </>
    )
  }

  return (
    <>
      <Link to="/">← 教材パック</Link>
      <h1>{pack.manifest.title}</h1>
      <LinkList
        items={units.map(({ unit, itemCount, learnedCount }) => ({
          key: String(unit.id),
          to: `/packs/${encodeURIComponent(packId)}/units/${unit.id}`,
          title: unit.title
            ? `ユニット ${unit.id}　${unit.title}`
            : `ユニット ${unit.id}`,
          meta: `${itemCount} 語・学習済み ${learnedCount} 語`,
        }))}
      />
    </>
  )
}
