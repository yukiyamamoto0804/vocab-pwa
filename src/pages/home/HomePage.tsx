import { Link } from 'react-router'
import { StorageStatus } from '../../components/StorageStatus'

export function HomePage() {
  return (
    <>
      <h1>教材パック</h1>
      <StorageStatus warningOnly />
      <p>
        教材パックがまだありません。
        <Link to="/import">取り込み</Link>から追加してください。
      </p>
    </>
  )
}
