import { Link } from 'react-router'
import { LinkList } from '../../components/LinkList'
import { LoadError } from '../../components/LoadError'
import { Loading } from '../../components/Loading'
import { StorageStatus } from '../../components/StorageStatus'
import { listPacks } from '../../db/packs'
import { DEMO_PACK_ID, demoPackInfo } from '../../features/demo/demoPack'
import { useAsync } from '../../lib/useAsync'
import { DemoButton } from './DemoButton'

export function HomePage() {
  const packs = useAsync(() => listPacks(), [])

  return (
    <>
      <h1>教材パック</h1>
      <StorageStatus warningOnly />
      {packs.status === 'loading' && <Loading />}
      {packs.status === 'error' && <LoadError />}
      {packs.status === 'done' && packs.value.length === 0 && (
        <p>
          教材パックがまだありません。
          <Link to="/import">取り込み</Link>から追加してください。
        </p>
      )}
      {packs.status === 'done' && packs.value.length > 0 && (
        <LinkList
          items={packs.value.map(({ pack, itemCount, unitCount }) => ({
            key: pack.id,
            to: `/packs/${encodeURIComponent(pack.id)}`,
            title: pack.manifest.title,
            meta: `${itemCount} 語・${unitCount} ユニット`,
          }))}
        />
      )}
      {packs.status === 'done' && demoPackInfo && (
        <DemoButton
          info={demoPackInfo}
          existing={
            packs.value.find(({ pack }) => pack.id === DEMO_PACK_ID)?.pack
          }
          prominent={packs.value.length === 0}
        />
      )}
    </>
  )
}
