import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import { readPackForExport } from '../../db/backup'
import { getAudioBlob } from '../../db/content'
import { db as defaultDb, type VocabDatabase } from '../../db/database'
import type { ContentItem, Manifest } from '../../db/types'

// 端末に保存した教材から、教材パックの zip を作り直す（docs/specs/backup.md 4 章）。
// 取り込みの画面でそのまま取り込める形にする

/** zip のファイル名 <パックの id>.zip。ファイル名に使えない文字は _ に置き換える（zip の中の id はそのまま） */
export function packZipFileName(packId: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字もファイル名に使えないので置き換える
  return `${packId.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')}.zip`
}

/**
 * パックの zip を作る。音声はすでに圧縮された形式なので圧縮せずに入れ、
 * 1 ファイルずつ読みながら zip に流す（全体を 2 重にメモリに持たない）
 */
export async function createPackZipFile(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<File> {
  const data = await readPackForExport(packId, db)
  if (!data) throw new Error(`教材パック ${packId} がありません`)
  const { pack, units, items, audioFiles } = data

  // 自動で区切ったパックは、取り込んだときの manifest に units がない。
  // 単語に入れる unit が取り込みの検証を通るよう、units はユニットのテーブルから作り直す
  const manifest: Manifest = {
    ...pack.manifest,
    units: units.map(({ id, title }) =>
      title === undefined ? { id } : { id, title },
    ),
  }
  // 並び順などアプリが足した項目は入れない。unit は取り込んだときに決まった番号を入れ、同じ区切りで戻す
  const contentItems: ContentItem[] = items.map(
    ({ packId: _, order: __, ...item }) => item,
  )

  // 届いた塊はすぐ Blob にして、元のバイト列を手放せるようにする。
  // ZipPassThrough は音声のバイト列をそのまま渡すので、配列に溜めると最後の File と合わせて全体を 2 重に持つ
  const parts: Blob[] = []
  let failed: unknown
  const zip = new Zip((err, chunk) => {
    if (err) failed = err
    else parts.push(new Blob([chunk]))
  })
  // JSON は整形せずに書く（取り込みの大きさの上限を超えないように）
  const addJson = (name: string, value: unknown) => {
    const entry = new ZipDeflate(name, { level: 6 })
    zip.add(entry)
    entry.push(strToU8(JSON.stringify(value)), true)
  }
  addJson('manifest.json', manifest)
  addJson('items.json', contentItems)
  // 音声は大きいので、1 つのトランザクションでまとめて読まず、1 つずつ読む。
  // 書き出しの途中で別のタブがパックを取り込み直すと新旧が混ざりうるが、まれなので受け入れる
  for (const file of audioFiles) {
    const blob = await getAudioBlob(packId, file, db)
    if (!blob) throw new Error(`音声 ${file} がありません`)
    const entry = new ZipPassThrough(`audio/${file}`)
    zip.add(entry)
    entry.push(new Uint8Array(await blob.arrayBuffer()), true)
    if (failed) break
  }
  zip.end()
  if (failed) throw failed
  return new File(parts, packZipFileName(packId), { type: 'application/zip' })
}
