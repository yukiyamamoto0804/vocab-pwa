import { type ChangeEvent, useState } from 'react'
import { Link } from 'react-router'
import { clearAudioCache } from '../../features/audio/player'
import {
  type ImportResult,
  importPack,
} from '../../features/content-pack/importPack'
import styles from './ImportPage.module.css'

type State =
  | { status: 'idle' }
  | { status: 'importing'; fileName: string }
  | { status: 'done'; result: ImportResult }

/** 一度に表示する誤りの数 */
const MAX_ERRORS_SHOWN = 50

export function ImportPage() {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 同じファイルを選び直しても反応するように
    if (!file) return
    setState({ status: 'importing', fileName: file.name })
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const result = await importPack(bytes)
      // 音声が差し替わっていても古いものが鳴らないように、デコード済みの音声を捨てる
      if (result.ok) clearAudioCache()
      setState({ status: 'done', result })
    } catch (err) {
      // ファイルを読めないなど、想定外の失敗でも「取り込み中」のまま止まらないようにする
      const message = err instanceof Error ? err.message : String(err)
      setState({
        status: 'done',
        result: {
          ok: false,
          errors: [
            { where: file.name, message: `読み込めませんでした（${message}）` },
          ],
        },
      })
    }
  }

  return (
    <>
      <h1>取り込み</h1>
      <p>教材パック（zip）を選ぶと、この端末の中に保存します。</p>
      <label
        className={styles.picker}
        data-disabled={state.status === 'importing'}
      >
        教材パックを選ぶ
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFile}
          disabled={state.status === 'importing'}
        />
      </label>

      {state.status === 'importing' && (
        <p className={styles.message}>{state.fileName} を取り込んでいます…</p>
      )}
      {state.status === 'done' && <Result result={state.result} />}
    </>
  )
}

function Result({ result }: { result: ImportResult }) {
  if (result.ok) {
    return (
      <div className={styles.message} data-kind="success">
        <p>
          「{result.title}」を{result.replaced ? '更新し' : '取り込み'}ました（
          {result.itemCount} 語・{result.unitCount} ユニット）。
        </p>
        {result.replaced && (
          <p>
            前の版との違い: 追加 {result.added} 語・削除 {result.removed}{' '}
            語・内容の変更 {result.changed} 語・変更なし {result.unchanged}{' '}
            語。学習記録は、id が同じ単語に引き継がれます。
          </p>
        )}
        <Link to={`/packs/${encodeURIComponent(result.packId)}`}>
          ユニット一覧へ
        </Link>
      </div>
    )
  }
  const shown = result.errors.slice(0, MAX_ERRORS_SHOWN)
  const rest = result.errors.length - shown.length
  return (
    <div className={styles.message} data-kind="error">
      <p>取り込めませんでした。次の点を直してください。</p>
      <ul className={styles.errors}>
        {shown.map((e, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同じ内容の誤りが並ぶことがあり、一覧は並び替えない
          <li key={i}>
            <span className={styles.where}>{e.where}</span>: {e.message}
          </li>
        ))}
      </ul>
      {rest > 0 && <p>ほか {rest} 件</p>}
    </div>
  )
}
