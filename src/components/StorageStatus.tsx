import { useEffect, useState } from 'react'
import { ensurePersistentStorage } from '../lib/storage'
import styles from './StorageStatus.module.css'

type PersistState = 'checking' | 'persisted' | 'not-persisted'

const messages: Record<PersistState, string> = {
  checking: '保存領域を確認しています…',
  persisted: 'この端末のデータは自動削除されない設定です',
  'not-persisted':
    'データが自動削除される可能性があります。ホーム画面に追加して使ってください',
}

interface Props {
  /** true なら、自動削除される可能性があるときだけ表示する */
  warningOnly?: boolean
}

export function StorageStatus({ warningOnly = false }: Props) {
  const [state, setState] = useState<PersistState>('checking')

  useEffect(() => {
    let active = true
    ensurePersistentStorage().then((ok) => {
      if (active) setState(ok ? 'persisted' : 'not-persisted')
    })
    return () => {
      active = false
    }
  }, [])

  if (warningOnly && state !== 'not-persisted') return null
  return (
    <p className={styles.status} data-state={state}>
      {messages[state]}
    </p>
  )
}
