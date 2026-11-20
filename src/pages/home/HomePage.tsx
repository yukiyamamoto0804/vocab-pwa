import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { StorageStatus } from '../../components/StorageStatus'
import { listPacks, type PackSummary } from '../../db/packs'
import styles from './HomePage.module.css'

export function HomePage() {
  const [packs, setPacks] = useState<PackSummary[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let active = true
    listPacks()
      .then((list) => {
        if (active) setPacks(list)
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <h1>教材パック</h1>
      <StorageStatus warningOnly />
      {loadFailed && (
        <p className={styles.error}>
          端末内の保存領域を読み込めませんでした。プライベートブラウズを使っている場合は、通常のモードで開いてください。
        </p>
      )}
      {packs?.length === 0 && (
        <p>
          教材パックがまだありません。
          <Link to="/import">取り込み</Link>から追加してください。
        </p>
      )}
      {packs && packs.length > 0 && (
        <ul className={styles.list}>
          {packs.map(({ pack, itemCount, unitCount }) => (
            <li key={pack.id}>
              <Link
                to={`/packs/${encodeURIComponent(pack.id)}`}
                className={styles.pack}
              >
                <span className={styles.title}>{pack.manifest.title}</span>
                <span className={styles.meta}>
                  {itemCount} 語・{unitCount} ユニット
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
