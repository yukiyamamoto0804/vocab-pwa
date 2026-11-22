import { unzipSync } from 'fflate'
import type { PackError } from './packError'

// 教材パック（zip）を展開し、manifest.json・items.json・audio/ の中身を取り出す。
// JSON の中身の検証は validatePack で行う。

/** 壊れた zip や極端に大きい zip で端末が固まらないための上限 */
export const ZIP_LIMITS = {
  maxFiles: 10_000,
  /** 展開後の合計サイズ（バイト）。zip そのものの大きさも、これを超えたら読み込まない */
  maxTotalBytes: 200 * 1024 * 1024,
  /** manifest.json・items.json 1 つの大きさ（バイト）。巨大な JSON を文字列にしてメモリが足りなくなるのを防ぐ */
  maxJsonBytes: 20 * 1024 * 1024,
}

const toMb = (bytes: number) => bytes / 1024 / 1024

/**
 * 読み込む前に、zip ファイルそのものの大きさを確かめる。大きすぎるファイルを丸ごとメモリに読み込むと、
 * 上限の判定にたどり着く前に端末が落ちることがあるため。問題なければ undefined
 */
export function checkZipSize(
  size: number,
  limits = ZIP_LIMITS,
): PackError[] | undefined {
  return size > limits.maxTotalBytes
    ? [
        {
          where: 'zip',
          message: `ファイルが大きすぎます（上限 ${toMb(limits.maxTotalBytes)} MB）`,
        },
      ]
    : undefined
}

export type ReadZipResult =
  | {
      ok: true
      manifest: unknown
      items: unknown
      /** audio/ からの相対パス → 中身 */
      audio: Map<string, Uint8Array<ArrayBuffer>>
    }
  | { ok: false; errors: PackError[] }

const fail = (where: string, message: string): ReadZipResult => ({
  ok: false,
  errors: [{ where, message }],
})

// OS が zip に入れる付属ファイル（macOS の __MACOSX/ や .DS_Store など）は読まない
function isJunk(path: string): boolean {
  return (
    path.endsWith('/') ||
    path.startsWith('__MACOSX/') ||
    path.split('/').some((part) => part.startsWith('.'))
  )
}

export function readPackZip(
  bytes: Uint8Array,
  limits = ZIP_LIMITS,
): ReadZipResult {
  let fileCount = 0
  let totalBytes = 0
  let overLimit = false
  let files: Record<string, Uint8Array<ArrayBuffer>>
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (overLimit || isJunk(file.name)) return false
        fileCount += 1
        totalBytes += file.originalSize
        if (
          fileCount > limits.maxFiles ||
          totalBytes > limits.maxTotalBytes ||
          (/(^|\/)(manifest|items)\.json$/.test(file.name) &&
            file.originalSize > limits.maxJsonBytes)
        ) {
          overLimit = true
          return false
        }
        return true
      },
    })
  } catch {
    return fail('zip', 'zip ファイルとして開けませんでした')
  }
  if (overLimit) {
    return fail(
      'zip',
      `ファイル数（上限 ${limits.maxFiles}）、展開後のサイズ（上限 ${toMb(limits.maxTotalBytes)} MB）、または manifest.json・items.json の大きさ（上限 ${toMb(limits.maxJsonBytes)} MB）が大きすぎます`,
    )
  }

  // フォルダごと圧縮した zip（全体が 1 つのフォルダに入っている）にも対応する
  const root = findRoot(Object.keys(files))
  if (root === 'many')
    return fail(
      'zip',
      'manifest.json が複数あります。教材パックごとに別の zip にしてください',
    )
  if (root === null) return fail('zip', 'manifest.json が見つかりません')
  const prefix = root

  const manifest = parseJson(files[`${prefix}manifest.json`])
  if (!manifest.ok) return fail('manifest.json', manifest.message)
  const itemsFile = files[`${prefix}items.json`]
  if (!itemsFile) return fail('zip', 'items.json が見つかりません')
  const items = parseJson(itemsFile)
  if (!items.ok) return fail('items.json', items.message)

  const audio = new Map<string, Uint8Array<ArrayBuffer>>()
  const audioPrefix = `${prefix}audio/`
  for (const [path, data] of Object.entries(files)) {
    if (path.startsWith(audioPrefix) && path.length > audioPrefix.length)
      audio.set(path.slice(audioPrefix.length), data)
  }

  return { ok: true, manifest: manifest.value, items: items.value, audio }
}

/** manifest.json のあるフォルダ（直下なら ''）。見つからなければ null、1 つのフォルダの下に複数あれば 'many' */
function findRoot(paths: string[]): string | null | 'many' {
  if (paths.includes('manifest.json')) return ''
  const nested = paths.filter((p) => /^[^/]+\/manifest\.json$/.test(p))
  if (nested.length > 1) return 'many'
  if (nested.length === 0) return null
  return nested[0].slice(0, -'manifest.json'.length)
}

function parseJson(
  data: Uint8Array,
): { ok: true; value: unknown } | { ok: false; message: string } {
  let text: string
  try {
    // UTF-8 でない文字（Shift_JIS で保存したものなど）があれば、文字化けしたまま取り込まずにエラーにする。
    // 先頭の BOM は TextDecoder が取り除く
    text = new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    return {
      ok: false,
      message:
        'UTF-8 として読めませんでした。文字コードを UTF-8 にして保存してください',
    }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, message: 'JSON として読めませんでした' }
  }
}
