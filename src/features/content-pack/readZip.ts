import { strFromU8, unzipSync } from 'fflate'
import type { PackError } from './packError'

// 教材パック（zip）を展開し、manifest.json・items.json・audio/ の中身を取り出す。
// JSON の中身の検証は validatePack で行う。

/** 壊れた zip や極端に大きい zip で端末が固まらないための上限 */
export const ZIP_LIMITS = {
  maxFiles: 10_000,
  /** 展開後の合計サイズ（バイト） */
  maxTotalBytes: 200 * 1024 * 1024,
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
        if (fileCount > limits.maxFiles || totalBytes > limits.maxTotalBytes) {
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
      `ファイル数（上限 ${limits.maxFiles}）または展開後のサイズ（上限 ${limits.maxTotalBytes / 1024 / 1024} MB）が大きすぎます`,
    )
  }

  // フォルダごと圧縮した zip（全体が 1 つのフォルダに入っている）にも対応する
  const prefix = findRoot(Object.keys(files))
  if (prefix === null) return fail('zip', 'manifest.json が見つかりません')

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

function findRoot(paths: string[]): string | null {
  if (paths.includes('manifest.json')) return ''
  const nested = paths.filter((p) => /^[^/]+\/manifest\.json$/.test(p))
  if (nested.length !== 1) return null
  return nested[0].slice(0, -'manifest.json'.length)
}

function parseJson(
  data: Uint8Array,
): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    // 先頭の BOM は取り除く
    return { ok: true, value: JSON.parse(strFromU8(data).replace(/^﻿/, '')) }
  } catch {
    return { ok: false, message: 'JSON として読めませんでした' }
  }
}
