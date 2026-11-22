import { db as defaultDb, type VocabDatabase } from '../../db/database'
import type { PackRecord } from '../../db/types'
import { clearUnplayable } from '../audio/playback'
import { clearAudioCache } from '../audio/player'
import { type ImportResult, importPack } from '../content-pack/importPack'
import { readPackZip } from '../content-pack/readZip'

// デモ教材の受け取りと取り込み、更新の判定（docs/specs/demo-pack.md 6 章）

/** ビルドのときに demo/manifest.json などから埋め込む値。demo/ がなければ null（scripts/build/demoPack.ts の DemoPackInfo と揃える） */
export interface DemoPackInfo {
  title: string
  createdAt?: string
  license?: string
  attribution?: string
  /** items.json の SHA-256 */
  itemsSha256: string
}

declare const __DEMO_PACK__: DemoPackInfo | null

export const demoPackInfo: DemoPackInfo | null = __DEMO_PACK__

/** デモ教材のパックの id。デモ専用とする（scripts/demo/lib/checks.mjs の PACK_ID と揃える） */
export const DEMO_PACK_ID = 'demo-ngsl'

/**
 * zip の URL。配信物の置き場所からの相対で、ブラウザのキャッシュに残った古い zip を受け取らないよう、
 * items.json の SHA-256 の先頭を付ける
 */
export function demoZipUrl(info: DemoPackInfo): string {
  // 置き場所は scripts/build/demoPack.ts の DEMO_ZIP と揃える
  return `demo/demo-ngsl.zip?v=${info.itemsSha256.slice(0, 12)}`
}

/**
 * ボタンの状態。new: まだ取り込んでいない、open: 同じ版を取り込み済み、update: 違う版（またはふつうの取り込みで入れたもの）
 */
export type DemoState = 'new' | 'open' | 'update'

export function demoState(
  info: DemoPackInfo,
  existing: PackRecord | undefined,
): DemoState {
  if (!existing) return 'new'
  return existing.demoItemsSha256 === info.itemsSha256 ? 'open' : 'update'
}

interface ImportDemoOptions {
  db?: VocabDatabase
  fetch?: typeof globalThis.fetch
  now?: number
}

/** デモ教材を受け取って取り込み、取り込んだ版を記録する */
export async function importDemo(
  info: DemoPackInfo,
  {
    db = defaultDb,
    fetch = globalThis.fetch,
    now = Date.now(),
  }: ImportDemoOptions = {},
): Promise<ImportResult> {
  const where = 'デモ教材'
  let bytes: Uint8Array
  try {
    const res = await fetch(demoZipUrl(info))
    if (!res.ok)
      return {
        ok: false,
        errors: [{ where, message: `受け取れませんでした（${res.status}）` }],
      }
    bytes = new Uint8Array(await res.arrayBuffer())
  } catch {
    return {
      ok: false,
      errors: [
        {
          where,
          message:
            '受け取れませんでした。ネットにつないでから、もう一度試してください',
        },
      ],
    }
  }
  // ほかのパックを上書きしないよう、保存する前に id を確かめる（展開できない zip は importPack が理由を返す）
  const zip = readPackZip(bytes)
  if (!zip.ok) return zip
  const manifest = zip.manifest
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('id' in manifest) ||
    manifest.id !== DEMO_PACK_ID
  )
    return {
      ok: false,
      errors: [
        { where, message: `パックの id が ${DEMO_PACK_ID} ではありません` },
      ],
    }
  const result = await importPack(bytes, { db, now })
  if (!result.ok) return result
  // 取り込むときに計算せず、埋め込んだ値を保存する（計算に使う機能は HTTPS でしか使えないため）
  await db.packs.update(DEMO_PACK_ID, { demoItemsSha256: info.itemsSha256 })
  // 音声が差し替わっていても古いものが鳴らないように、デコード済みの音声を捨てる
  clearAudioCache()
  clearUnplayable()
  return result
}
