import { Link, useParams } from 'react-router'

export function WordsPage() {
  const { packId = '', unitId } = useParams()
  return (
    <>
      <Link to={`/packs/${encodeURIComponent(packId)}`}>← ユニット一覧</Link>
      <h1>ユニット {unitId}</h1>
      <p>ユニット内の単語を表示します（準備中）。</p>
    </>
  )
}
