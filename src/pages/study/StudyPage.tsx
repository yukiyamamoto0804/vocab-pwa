import { Link, useSearchParams } from 'react-router'
import { parseStudyQuery } from '../../features/session/studyQuery'

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

  return (
    <>
      <h1>{query.mode === 'unit' ? 'ユニット学習' : 'テスト'}</h1>
      <p>ユニット {query.unitIds.join(', ')} を出題します（準備中）。</p>
    </>
  )
}
