import { replaceBackupRecords } from '../../db/backup'
import type { VocabDatabase } from '../../db/database'
import {
  MAX_BACKUP_FILE_BYTES,
  type ParseBackupResult,
  parseRecordsBackup,
  ZIP_MESSAGE,
} from './parseBackup'
import type { RecordsBackup } from './recordsFile'

// 学習記録のインポート（docs/specs/backup.md 6 章）

/**
 * 選んだファイルを読み、確かめる。大きすぎるファイルは、丸ごと読む前に断る。
 * 教材の zip は大きいことが多いので、大きさより先に先頭を見て、取り込みの画面を案内する
 */
export async function readRecordsBackupFile(
  file: File,
): Promise<ParseBackupResult> {
  if ((await file.slice(0, 2).text()) === 'PK')
    return { ok: false, errors: [ZIP_MESSAGE] }
  if (file.size > MAX_BACKUP_FILE_BYTES)
    return {
      ok: false,
      errors: [
        `ファイルが大きすぎます（上限 ${MAX_BACKUP_FILE_BYTES / 1024 / 1024} MB）。`,
      ],
    }
  return parseRecordsBackup(await file.text())
}

/** ファイルの中の、パックごとの記録の数 */
export interface PackBreakdown {
  packId: string
  /** 取り込み済みのパックならタイトル。取り込んでいなければ undefined */
  title: string | undefined
  studySessions: number
  progress: number
  reports: number
}

/**
 * ファイルの中身をパックごとに数える。取り込み済みのパックを packs の順に、
 * そのあとに取り込んでいないパックを id の順に並べる。記録のないパックは出さない
 */
export function summarizeBackup(
  backup: RecordsBackup,
  packs: readonly { id: string; title: string }[],
): PackBreakdown[] {
  const byPack = new Map<string, PackBreakdown>()
  const entry = (packId: string) => {
    let e = byPack.get(packId)
    if (!e) {
      e = {
        packId,
        title: undefined,
        studySessions: 0,
        progress: 0,
        reports: 0,
      }
      byPack.set(packId, e)
    }
    return e
  }
  for (const s of backup.studySessions) entry(s.packId).studySessions += 1
  for (const p of backup.progress) entry(p.packId).progress += 1
  for (const r of backup.reports) entry(r.packId).reports += 1

  const imported: PackBreakdown[] = []
  for (const pack of packs) {
    const e = byPack.get(pack.id)
    if (!e) continue
    imported.push({ ...e, title: pack.title })
    byPack.delete(pack.id)
  }
  const others = [...byPack.values()].sort((a, b) =>
    a.packId < b.packId ? -1 : a.packId > b.packId ? 1 : 0,
  )
  return [...imported, ...others]
}

/**
 * 端末の学習記録を、確かめたファイルの中身で置き換える。
 * 画面から db/ を直接呼ばず、features を通す（docs/ARCHITECTURE.md 3 章）ための入り口
 */
export function importRecordsBackup(
  backup: RecordsBackup,
  db?: VocabDatabase,
): Promise<void> {
  const { progress, studySessions, reports, settings } = backup
  return replaceBackupRecords(
    { progress, studySessions, reports, settings },
    db,
  )
}
