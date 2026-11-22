import { type BackupRecords, readBackupRecords } from '../../db/backup'
import { db as defaultDb, type VocabDatabase } from '../../db/database'

// 学習記録のファイル（docs/specs/backup.md 3 章）

/** このアプリの学習記録のファイルであることの印 */
export const BACKUP_FORMAT = 'vocab-pwa-backup'
/** 学習記録のファイルの形式の版。形式を変えたら上げ、読み込むときに古い版から移し替える */
export const BACKUP_VERSION = 1

export interface RecordsBackup extends BackupRecords {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  /** エクスポートした日時（エポックミリ秒） */
  exportedAt: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ファイル名 vocab-backup-YYYYMMDD-HHmm.json（端末の時刻） */
export function recordsBackupFileName(at: number): string {
  const d = new Date(at)
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`
  return `vocab-backup-${date}-${time}.json`
}

/** 端末の学習記録から、学習記録のファイルを作る。now はエクスポートした日時 */
export async function createRecordsBackupFile(
  now: number,
  db: VocabDatabase = defaultDb,
): Promise<File> {
  const backup: RecordsBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    ...(await readBackupRecords(db)),
  }
  return new File([JSON.stringify(backup)], recordsBackupFileName(now), {
    type: 'application/json',
  })
}
