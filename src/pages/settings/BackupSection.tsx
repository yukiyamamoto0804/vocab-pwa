import { useEffect, useRef, useState } from 'react'
import { getLastExport, saveLastExport } from '../../db/settings'
import { createRecordsBackupFile } from '../../features/backup/recordsFile'
import styles from './BackupSection.module.css'
import { type SaveFileResult, saveFile } from './saveFile'

/** 作ったファイルと、作った日時（ファイルの中身の時点） */
interface Created {
  file: File
  at: number
}

type Message =
  | { kind: Exclude<SaveFileResult, 'canceled'> }
  | { kind: 'create-error' }
  | { kind: 'save-error' }

const pad = (n: number) => String(n).padStart(2, '0')

/** 日時を「2026/11/23 14:05」の形にする（端末の時刻） */
function formatDateTime(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${pad(d.getMinutes())}`
}

// 学習記録のエクスポート（docs/specs/backup.md 5 章）。
// 共有の画面は押した直後でないと開けないため、ファイルを作る操作と保存する操作を分ける。
// 作ったファイルは、別の保存先にも保存できるよう、画面を離れるまで持っておく
export function BackupSection() {
  const [lastExport, setLastExport] = useState<number | 'none' | 'error'>()
  const [created, setCreated] = useState<Created>()
  const [busy, setBusy] = useState<'creating' | 'saving'>()
  const [message, setMessage] = useState<Message>()
  /** 作る・保存するの途中か。disabled は再描画の後に効くため、続けて押されたときはこちらで弾く */
  const working = useRef(false)

  useEffect(() => {
    let active = true
    getLastExport()
      .then((at) => {
        if (active) setLastExport(at ?? 'none')
      })
      .catch((e: unknown) => {
        console.error(e)
        if (active) setLastExport('error')
      })
    return () => {
      active = false
    }
  }, [])

  async function create() {
    if (working.current) return
    working.current = true
    setBusy('creating')
    setMessage(undefined)
    try {
      const at = Date.now()
      setCreated({ file: await createRecordsBackupFile(at), at })
    } catch (e) {
      console.error(e)
      setMessage({ kind: 'create-error' })
    } finally {
      working.current = false
      setBusy(undefined)
    }
  }

  async function save({ file, at }: Created) {
    if (working.current) return
    working.current = true
    setBusy('saving')
    setMessage(undefined)
    try {
      const result = await saveFile(file)
      if (result === 'canceled') return
      setMessage({ kind: result })
      setLastExport(at)
      // 日時を残せなくても、ファイルは保存できているので知らせない
      saveLastExport(at).catch((e: unknown) => console.error(e))
    } catch (e) {
      console.error(e)
      setMessage({ kind: 'save-error' })
    } finally {
      working.current = false
      setBusy(undefined)
    }
  }

  return (
    <div className={styles.section}>
      <p className={styles.note}>
        学習記録（定着度・回答の記録・誤りの報告・学習の設定）を 1
        つのファイルに書き出します。教材は含みません。
      </p>
      {lastExport !== undefined && lastExport !== 'error' && (
        <p className={styles.note}>
          {lastExport === 'none'
            ? 'まだエクスポートしていません。'
            : `最後にエクスポートした記録: ${formatDateTime(lastExport)} 時点`}
        </p>
      )}

      {created && (
        <div className={styles.ready}>
          <p>
            ファイルができました（{created.file.name}
            ）。「保存する」を押して保存先を選んでください。
          </p>
          <button
            type="button"
            className={styles.button}
            disabled={busy !== undefined}
            onClick={() => save(created)}
          >
            {busy === 'saving' ? '保存しています…' : '保存する'}
          </button>
        </div>
      )}
      <button
        type="button"
        className={created ? styles.secondary : styles.button}
        disabled={busy !== undefined}
        onClick={create}
      >
        {busy === 'creating'
          ? '作っています…'
          : created
            ? '今の記録で作り直す'
            : '学習記録をエクスポート'}
      </button>

      {message && (
        <p
          className={
            message.kind.endsWith('error') ? styles.error : styles.done
          }
          role={message.kind.endsWith('error') ? 'alert' : 'status'}
        >
          {MESSAGES[message.kind]}
        </p>
      )}

      <p className={styles.note}>学習記録のインポートは準備中です。</p>
    </div>
  )
}

const MESSAGES: Record<Message['kind'], string> = {
  shared: '学習記録を書き出しました。',
  downloaded:
    '学習記録をダウンロードしました（ブラウザのダウンロードの保存先にあります）。',
  'create-error': '学習記録を読み出せませんでした。もう一度押してください。',
  'save-error': '保存できませんでした。もう一度「保存する」を押してください。',
}
