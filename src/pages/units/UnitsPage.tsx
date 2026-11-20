import { useParams } from 'react-router'

export function UnitsPage() {
  const { packId } = useParams()
  return (
    <>
      <h1>ユニット一覧</h1>
      <p>パック {packId} のユニットを表示します（準備中）。</p>
    </>
  )
}
