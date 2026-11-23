import { type ChangeEvent, useRef, useState } from 'react'
import { BottomSheet } from '../../components/BottomSheet'
import { countBackupRecords, type RecordCounts } from '../../db/backup'
import { listPacks } from '../../db/packs'
import {
  importRecordsBackup,
  type PackBreakdown,
  readRecordsBackupFile,
  summarizeBackup,
} from '../../features/backup/importRecords'
import type { RecordsBackup } from '../../features/backup/recordsFile'
import styles from './BackupSection.module.css'
import { ExportBackup } from './ExportBackup'
import { formatDateTime } from './formatDateTime'

/** 置き換える前の確認に出す内容 */
interface Pending {
  backup: RecordsBackup
  breakdown: PackBreakdown[]
  current: RecordCounts
}

type Message =
  | { kind: 'done'; counts: RecordCounts }
  | { kind: 'error'; errors: string[] }

const countsOf = (backup: RecordsBackup): RecordCounts => ({
  studySessions: backup.studySessions.length,
  progress: backup.progress.length,
  reports: backup.reports.length,
})

const describeCounts = (c: RecordCounts) =>
  `学習 ${c.studySessions} 回・学習済み ${c.progress} 語・報告 ${c.reports} 件`

// 学習記録のインポート（docs/specs/backup.md 6・7 章）。
// 端末の学習記録をファイルの中身で置き換えるので、置き換える前に中身と今の記録の件数を見せて確かめる
export function ImportRecords({
  onReplaced,
  onSheetClosed,
}: {
  onReplaced: () => void
  /** 確認のシートを閉じたとき（シートの中でエクスポートしたかもしれないので、外側の表示を読み直させる） */
  onSheetClosed: () => void
}) {
  const [reading, setReading] = useState(false)
  const [pending, setPending] = useState<Pending>()
  const [message, setMessage] = useState<Message>()
  /** 読み込みの途中か。続けてファイルを選ばれたときに弾く */
  const working = useRef(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを選び直しても反応するように
    if (!file || working.current) return
    working.current = true
    setReading(true)
    setMessage(undefined)
    try {
      const result = await readRecordsBackupFile(file)
      if (!result.ok) {
        setMessage({ kind: 'error', errors: result.errors })
        return
      }
      const [packs, current] = await Promise.all([
        listPacks(),
        countBackupRecords(),
      ])
      setPending({
        backup: result.backup,
        breakdown: summarizeBackup(
          result.backup,
          packs.map(({ pack }) => ({
            id: pack.id,
            title: pack.manifest.title,
          })),
        ),
        current,
      })
    } catch (err) {
      console.error(err)
      const detail = err instanceof Error ? err.message : String(err)
      setMessage({
        kind: 'error',
        errors: [`読み込めませんでした（${detail}）`],
      })
    } finally {
      working.current = false
      setReading(false)
    }
  }

  return (
    <>
      <p className={styles.note}>
        書き出したファイルを読み込み、この端末の学習記録を置き換えます。教材は「取り込み」の画面から取り込んでください。
      </p>
      <label className={styles.picker} data-disabled={reading}>
        {reading ? '読み込んでいます…' : '学習記録をインポート'}
        {/* 端末によっては JSON が別の種類として扱われ、選べなくなるので、種類で絞らない（中身はアプリで確かめる） */}
        <input type="file" onChange={handleFile} disabled={reading} />
      </label>

      {message?.kind === 'done' && (
        <p className={styles.done} role="status">
          学習記録を置き換えました（{describeCounts(message.counts)}）。
        </p>
      )}
      {message?.kind === 'error' && (
        <div className={styles.error} role="alert">
          <p>読み込めませんでした。ファイルを確かめてください。</p>
          <ul className={styles.errors}>
            {message.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {pending && (
        <ConfirmSheet
          pending={pending}
          onClose={() => {
            setPending(undefined)
            onSheetClosed()
          }}
          onDone={() => {
            setPending(undefined)
            onSheetClosed()
            setMessage({ kind: 'done', counts: countsOf(pending.backup) })
            onReplaced()
          }}
        />
      )}
    </>
  )
}

function ConfirmSheet({
  pending: { backup, breakdown, current },
  onClose,
  onDone,
}: {
  pending: Pending
  onClose: () => void
  onDone: () => void
}) {
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState<string>()
  /** 置き換えの途中か。disabled は再描画の後に効くため、続けて押されたときはこちらで弾く */
  const working = useRef(false)
  const hasCurrent =
    current.studySessions + current.progress + current.reports > 0

  async function replace() {
    if (working.current) return
    working.current = true
    setReplacing(true)
    setError(undefined)
    try {
      await importRecordsBackup(backup)
      onDone()
    } catch (err) {
      // 1 つのトランザクションで置き換えるので、失敗しても今の記録はそのまま残っている
      console.error(err)
      const detail = err instanceof Error ? err.message : String(err)
      setError(`置き換えられませんでした。今の記録はそのままです（${detail}）`)
      setReplacing(false)
      working.current = false
    }
  }

  return (
    // 置き換えの途中で閉じると結果が見えないので、終わるまで閉じられないようにする
    <BottomSheet
      title="学習記録を置き換える"
      onClose={onClose}
      closable={!replacing}
    >
      <div className={styles.sheet}>
        <section>
          <h3>読み込むファイル</h3>
          <p>
            {formatDateTime(backup.exportedAt)} 時点の記録:{' '}
            {describeCounts(countsOf(backup))}
          </p>
          {breakdown.length > 0 && (
            <ul className={styles.breakdown}>
              {breakdown.map((b) => (
                <li key={b.packId}>
                  <span className={styles.packName}>{b.title ?? b.packId}</span>
                  {b.title === undefined && '（教材を取り込むと使えます）'}:{' '}
                  {describeCounts(b)}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>この端末の今の記録</h3>
          <p>{describeCounts(current)}</p>
          {hasCurrent && (
            <>
              <p className={styles.warning}>
                今の記録は消えます。残しておくなら、先にエクスポートしてください。
              </p>
              <ExportBackup compact />
            </>
          )}
        </section>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className={styles.button}
          onClick={replace}
          disabled={replacing}
        >
          {replacing ? '置き換えています…' : '置き換える'}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={onClose}
          disabled={replacing}
        >
          やめる
        </button>
      </div>
    </BottomSheet>
  )
}
