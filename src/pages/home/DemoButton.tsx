import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BottomSheet } from '../../components/BottomSheet'
import { PackCredits } from '../../components/PackCredits'
import type { PackRecord } from '../../db/types'
import {
  DEMO_PACK_ID,
  type DemoPackInfo,
  demoState,
  importDemo,
} from '../../features/demo/demoPack'
import styles from './DemoButton.module.css'

const LABELS = {
  new: 'デモを試す',
  open: 'デモを開く',
  update: 'デモを更新',
} as const

// ホームの「デモを試す」（docs/specs/demo-pack.md 6 章）。
// 教材パックがないときは目立たせ、あるときは一覧の下に小さく出す
export function DemoButton({
  info,
  existing,
  prominent,
}: {
  info: DemoPackInfo
  existing: PackRecord | undefined
  prominent: boolean
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const state = demoState(info, existing)
  const packPath = `/packs/${encodeURIComponent(DEMO_PACK_ID)}`

  return (
    <>
      <button
        type="button"
        className={prominent ? styles.prominent : styles.quiet}
        onClick={() => (state === 'open' ? navigate(packPath) : setOpen(true))}
      >
        {LABELS[state]}
      </button>
      {open && (
        <DemoSheet
          info={info}
          update={state === 'update'}
          onClose={() => setOpen(false)}
          onDone={() => navigate(packPath)}
        />
      )}
    </>
  )
}

function DemoSheet({
  info,
  update,
  onClose,
  onDone,
}: {
  info: DemoPackInfo
  update: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [status, setStatus] = useState<
    { busy: true } | { busy: false; error?: string }
  >({ busy: false })

  async function load() {
    setStatus({ busy: true })
    try {
      const result = await importDemo(info)
      if (result.ok) onDone()
      else
        setStatus({
          busy: false,
          error: [
            ...result.errors.map((e) => `${e.where}: ${e.message}`),
            '時間をおいて、もう一度試してください。',
          ].join('\n'),
        })
    } catch (err) {
      // 保存の失敗など、想定外の失敗でも「読み込んでいます」のまま止まらないようにする
      const message = err instanceof Error ? err.message : String(err)
      setStatus({ busy: false, error: `読み込めませんでした（${message}）` })
    }
  }

  return (
    // 読み込みの途中で閉じると、結果が見えないまま画面が移るので、終わるまで閉じられないようにする
    <BottomSheet title={info.title} onClose={onClose} closable={!status.busy}>
      <p className={styles.text}>
        20 語 × 2
        ユニットのデモ教材です。教材を用意しなくてもアプリを試せます。教材パックの形式（manifest.json・items.json・音声）の見本にもなります。
        {update && ' 新しい版があります。学習記録は引き継がれます。'}
      </p>
      <PackCredits
        createdAt={info.createdAt}
        license={info.license}
        attribution={info.attribution}
      />
      {status.busy === false && status.error && (
        <p className={styles.error} role="alert">
          {status.error}
        </p>
      )}
      <button
        type="button"
        className={styles.load}
        onClick={load}
        disabled={status.busy}
      >
        {status.busy ? '読み込んでいます…' : update ? '更新する' : '読み込む'}
      </button>
    </BottomSheet>
  )
}
