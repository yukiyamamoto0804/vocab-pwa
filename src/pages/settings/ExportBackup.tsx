import { useEffect, useRef, useState } from 'react'
import { listPacks } from '../../db/packs'
import {
  type ExportChoice,
  type ExportKind,
  getLastExport,
  getStoredExportChoice,
  saveExportChoice,
  saveLastExport,
} from '../../db/settings'
import {
  type ExportSelection,
  exportChoiceToSave,
  includesPacks,
  includesRecords,
  initialExportSelection,
} from '../../features/backup/exportChoice'
import { createPackZipFile } from '../../features/backup/packZip'
import { createRecordsBackupFile } from '../../features/backup/recordsFile'
import { DEMO_PACK_ID } from '../../features/demo/demoPack'
import styles from './BackupSection.module.css'
import { formatDateTime } from './formatDateTime'
import { formatFileSize } from './formatFileSize'
import { canShareFiles, saveFile, shareFiles } from './saveFile'

interface PackOption {
  id: string
  title: string
}

/** 作ったファイル。saved は一度でも保存したか */
interface CreatedFile {
  file: File
  kind: 'records' | 'pack'
  saved: boolean
}

/** 作ったファイルと、作った日時（学習記録の中身の時点） */
interface Created {
  files: CreatedFile[]
  at: number
  /**
   * 作ったときの選び方。最初に保存できたときに残す（作っただけで保存しなかったときは、
   * 後で取り込んだパックを「前回の後に取り込んだパック」として選べるよう残さない）
   */
  choice: ExportChoice | undefined
}

type Busy =
  | { step: 'creating'; pack?: { index: number; count: number } }
  | { step: 'saving' }

type Message =
  | {
      kind:
        | 'shared'
        | 'downloaded'
        | 'save-error'
        | 'share-all-error'
        | 'selection-changed'
    }
  | { kind: 'create-error'; detail: string }

const KIND_LABELS: Record<ExportKind, string> = {
  'records-and-packs': '教材と学習記録',
  records: '学習記録だけ',
  packs: '教材だけ',
}

// エクスポート（docs/specs/backup.md 2・5 章）。学習記録のファイルと、教材パックの zip を書き出す。
// 共有の画面は押した直後でないと開けないため、ファイルを作る操作と保存する操作を分ける。
// 作ったファイルは、別の保存先にも保存できるよう、画面を離れるまで持っておく。
// compact なら学習記録だけを書き出し、選び方・説明・最後にエクスポートした日時を出さない（インポートの確認の中に置くとき）。
// reloadKey が変わったら、最後にエクスポートした日時を読み直す（ほかの欄でエクスポートしたとき）
export function ExportBackup({
  compact = false,
  reloadKey,
}: {
  compact?: boolean
  reloadKey?: number
}) {
  const [lastExport, setLastExport] = useState<number | 'none' | 'error'>()
  /** 取り込み済みのパック（最初に取り込んだ順）。読み込むまでは undefined、読めなければ 'error' */
  const [packs, setPacks] = useState<PackOption[] | 'error'>()
  const [selection, setSelection] = useState<ExportSelection>({
    kind: 'records',
    packIds: new Set(),
  })
  const [created, setCreated] = useState<Created>()
  const [busy, setBusy] = useState<Busy>()
  const [message, setMessage] = useState<Message>()
  /** 作る・保存するの途中か。disabled は再描画の後に効くため、続けて押されたときはこちらで弾く */
  const working = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey は読み直すきっかけとしてだけ使う
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
  }, [reloadKey])

  useEffect(() => {
    if (compact) return
    let active = true
    Promise.all([listPacks(), getStoredExportChoice()])
      .then(([summaries, stored]) => {
        if (!active) return
        const options = summaries.map(({ pack }) => ({
          id: pack.id,
          title: pack.manifest.title,
        }))
        setPacks(options)
        setSelection(
          initialExportSelection(
            stored,
            options.map((p) => p.id),
            DEMO_PACK_ID,
          ),
        )
      })
      // 読めなかったときは、学習記録だけを書き出せるようにしておく
      .catch((e: unknown) => {
        console.error(e)
        if (active) setPacks('error')
      })
    return () => {
      active = false
    }
  }, [compact])

  const kind = compact ? 'records' : selection.kind
  /** 書き出すパック（取り込み済みの並びの順） */
  const packList = Array.isArray(packs) ? packs : []
  const selectedPacks =
    !compact && includesPacks(kind)
      ? packList.filter((p) => selection.packIds.has(p.id))
      : []
  const canCreate =
    busy === undefined &&
    (compact || packs !== undefined) &&
    (!includesPacks(kind) || selectedPacks.length > 0)

  /**
   * 書き出すものを選び直す。前に作ったファイルは選び方と合わなくなるので消す
   * （残すと、一覧の「保存する」で前の選び方のファイルを保存してしまう）
   */
  function changeSelection(next: ExportSelection) {
    setSelection(next)
    if (created) setMessage({ kind: 'selection-changed' })
    setCreated(undefined)
  }

  async function create() {
    if (working.current) return
    working.current = true
    setBusy({ step: 'creating' })
    setMessage(undefined)
    // 作り直すときは、前に作ったファイルを先に手放す（大きな zip が 2 組メモリに載らないように）
    setCreated(undefined)
    try {
      const at = Date.now()
      const files: CreatedFile[] = []
      if (includesRecords(kind)) {
        let file: File
        try {
          file = await createRecordsBackupFile(at)
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e)
          throw new Error(
            `学習記録を読み出せませんでした（${reason}）。もう一度押してください。`,
            { cause: e },
          )
        }
        files.push({ file, kind: 'records', saved: false })
      }
      // パックは 1 つずつ作る（スマホのメモリを一度に使いすぎないように）
      for (const [index, pack] of selectedPacks.entries()) {
        setBusy({
          step: 'creating',
          pack: { index: index + 1, count: selectedPacks.length },
        })
        let file: File
        try {
          file = await createPackZipFile(pack.id)
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e)
          throw new Error(
            `「${pack.title}」の zip を作れませんでした（${reason}）。${
              selectedPacks.length > 1
                ? '端末のメモリが足りないことがあるので、パックを 1 つずつ選んで作ってください。'
                : 'もう一度押してください。'
            }`,
            { cause: e },
          )
        }
        files.push({
          file: renameIfTaken(file, files),
          kind: 'pack',
          saved: false,
        })
      }
      setCreated({
        files,
        at,
        choice:
          !compact && Array.isArray(packs)
            ? exportChoiceToSave(
                selection,
                packs.map((p) => p.id),
              )
            : undefined,
      })
    } catch (e) {
      console.error(e)
      setMessage({
        kind: 'create-error',
        detail: e instanceof Error ? e.message : String(e),
      })
    } finally {
      working.current = false
      setBusy(undefined)
    }
  }

  /** 保存できたファイルに印を付け、学習記録を含むなら、最後にエクスポートした日時を残す */
  function markSaved(saved: CreatedFile[]) {
    if (!created) return
    const isSaved = (f: CreatedFile) => saved.some((t) => t.file === f.file)
    setCreated(
      (c) =>
        c && {
          ...c,
          choice: undefined,
          files: c.files.map((f) => (isSaved(f) ? { ...f, saved: true } : f)),
        },
    )
    // 最初に保存できたときに、作ったときの選び方を残す
    if (created.choice)
      saveExportChoice(created.choice).catch((e: unknown) => console.error(e))
    if (saved.some((f) => f.kind === 'records')) {
      setLastExport(created.at)
      // 日時を残せなくても、ファイルは保存できているので知らせない
      saveLastExport(created.at).catch((e: unknown) => console.error(e))
    }
  }

  async function save(target: CreatedFile) {
    if (working.current) return
    working.current = true
    setBusy({ step: 'saving' })
    setMessage(undefined)
    try {
      const result = await saveFile(target.file)
      if (result === 'canceled') return
      setMessage({ kind: result })
      markSaved([target])
    } catch (e) {
      console.error(e)
      setMessage({ kind: 'save-error' })
    } finally {
      working.current = false
      setBusy(undefined)
    }
  }

  async function saveAll(targets: CreatedFile[]) {
    if (working.current) return
    working.current = true
    setBusy({ step: 'saving' })
    setMessage(undefined)
    try {
      if ((await shareFiles(targets.map((f) => f.file))) === 'canceled') return
      setMessage({ kind: 'shared' })
      markSaved(targets)
    } catch (e) {
      console.error(e)
      setMessage({ kind: 'share-all-error' })
    } finally {
      working.current = false
      setBusy(undefined)
    }
  }

  const files = created?.files ?? []
  const canShareAll =
    files.length > 1 && canShareFiles(files.map((f) => f.file))

  return (
    <div className={styles.section}>
      {!compact && (
        <>
          <fieldset className={styles.choices} disabled={busy !== undefined}>
            <legend className={styles.note}>書き出すもの</legend>
            {(Object.keys(KIND_LABELS) as ExportKind[]).map((k) => (
              <label key={k} className={styles.choice}>
                <input
                  type="radio"
                  name="export-kind"
                  checked={selection.kind === k}
                  onChange={() => changeSelection({ ...selection, kind: k })}
                />
                {KIND_LABELS[k]}
              </label>
            ))}
          </fieldset>
          <p className={styles.note}>
            学習記録は、定着度・回答の記録・誤りの報告・学習の設定を 1
            つのファイルにします（すべてのパックの分）。教材は、パックごとに取り込める
            zip にします。
          </p>
          {includesPacks(kind) && packs !== undefined && (
            <fieldset className={styles.choices} disabled={busy !== undefined}>
              <legend className={styles.note}>書き出す教材パック</legend>
              {packs === 'error' && (
                <p className={styles.error} role="alert">
                  教材パックの一覧を読めませんでした。画面を開き直してください。
                </p>
              )}
              {packs !== 'error' && packs.length === 0 && (
                <p className={styles.note}>
                  取り込んだ教材パックがありません。
                </p>
              )}
              {packList.map((p) => (
                <label key={p.id} className={styles.choice}>
                  <input
                    type="checkbox"
                    checked={selection.packIds.has(p.id)}
                    onChange={(e) => {
                      const next = new Set(selection.packIds)
                      if (e.target.checked) next.add(p.id)
                      else next.delete(p.id)
                      changeSelection({ ...selection, packIds: next })
                    }}
                  />
                  {p.title}
                </label>
              ))}
            </fieldset>
          )}
          {lastExport !== undefined && lastExport !== 'error' && (
            <p className={styles.note}>
              {lastExport === 'none'
                ? '学習記録はまだエクスポートしていません。'
                : `最後にエクスポートした学習記録: ${formatDateTime(lastExport)} 時点`}
            </p>
          )}
        </>
      )}

      {created && (
        <div className={styles.ready}>
          <p>
            ファイルができました。「保存する」を押して保存先を選んでください。
          </p>
          <ul className={styles.files}>
            {files.map((f) => (
              <li key={f.file.name} className={styles.fileRow}>
                <span className={styles.fileName}>
                  {f.file.name}（{formatFileSize(f.file.size)}）
                  {f.saved && ' ✓ 保存済み'}
                </span>
                <button
                  type="button"
                  className={styles.button}
                  disabled={busy !== undefined}
                  onClick={() => save(f)}
                >
                  保存する
                </button>
              </li>
            ))}
          </ul>
          {canShareAll && (
            <button
              type="button"
              className={styles.button}
              disabled={busy !== undefined}
              onClick={() => saveAll(files)}
            >
              まとめて保存する
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        className={created ? styles.secondary : styles.button}
        disabled={!canCreate}
        onClick={create}
      >
        {busy?.step === 'creating'
          ? busy.pack
            ? `作っています…（教材 ${busy.pack.index} / ${busy.pack.count}）`
            : '作っています…'
          : busy?.step === 'saving'
            ? '保存しています…'
            : created
              ? compact
                ? '今の記録で作り直す'
                : '今の選び方で作り直す'
              : compact
                ? '学習記録をエクスポート'
                : 'エクスポート'}
      </button>

      {message && (
        <p
          className={
            message.kind.endsWith('error') ? styles.error : styles.done
          }
          role={message.kind.endsWith('error') ? 'alert' : 'status'}
        >
          {message.kind === 'create-error'
            ? `ファイルを作れませんでした。${message.detail}`
            : MESSAGES[message.kind]}
        </p>
      )}
    </div>
  )
}

const MESSAGES: Record<Exclude<Message['kind'], 'create-error'>, string> = {
  shared: '書き出しました。',
  'selection-changed':
    '書き出すものを変えたので、作ったファイルを消しました。もう一度「エクスポート」を押してください。',
  downloaded:
    'ダウンロードしました（ブラウザのダウンロードの保存先にあります）。',
  'save-error': '保存できませんでした。もう一度「保存する」を押してください。',
  'share-all-error':
    'まとめて保存できませんでした。ファイルごとの「保存する」で 1 つずつ保存してください。',
}

/**
 * ほかのファイルと名前が重なったら、番号を付けた名前にする（パックの id の置き換えで、別のパックが同じ名前になることがある）。
 * 名前を変えても中身は写さない（Blob を包むだけ）
 */
function renameIfTaken(file: File, others: CreatedFile[]): File {
  const taken = new Set(others.map((f) => f.file.name))
  if (!taken.has(file.name)) return file
  const base = file.name.replace(/\.zip$/, '')
  let n = 2
  while (taken.has(`${base}-${n}.zip`)) n += 1
  return new File([file], `${base}-${n}.zip`, { type: file.type })
}
