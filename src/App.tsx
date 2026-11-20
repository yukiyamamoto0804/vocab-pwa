import { useEffect, useState } from 'react'
import styles from './App.module.css'
import { requestPersistentStorage } from './lib/storage'

type PersistState = 'checking' | 'persisted' | 'not-persisted'

const persistMessages: Record<PersistState, string> = {
  checking: '保存領域を確認しています…',
  persisted: 'この端末のデータは自動削除されない設定です',
  'not-persisted':
    'データが自動削除される可能性があります。ホーム画面に追加して使ってください',
}

function App() {
  const [persist, setPersist] = useState<PersistState>('checking')

  useEffect(() => {
    requestPersistentStorage().then((ok) =>
      setPersist(ok ? 'persisted' : 'not-persisted'),
    )
  }, [])

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>単語帳</h1>
      <p className={styles.lead}>
        教材パックを取り込んで学習を始めましょう（準備中）
      </p>
      <p className={styles.status} data-state={persist}>
        {persistMessages[persist]}
      </p>
    </main>
  )
}

export default App
