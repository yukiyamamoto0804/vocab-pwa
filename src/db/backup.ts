import { db as defaultDb, type VocabDatabase } from './database'
import { isBackedUpSettingKey } from './settings'
import type {
  ProgressRecord,
  ReportRecord,
  SettingRecord,
  StudySessionRecord,
} from './types'

// 学習記録のバックアップの読み書き（docs/specs/backup.md）

/** 学習記録のファイルに含める記録（docs/specs/backup.md 3 章） */
export interface BackupRecords {
  progress: ProgressRecord[]
  studySessions: StudySessionRecord[]
  reports: ReportRecord[]
  settings: SettingRecord[]
}

/**
 * 学習記録のファイルに含める記録を読み出す。
 * 別のタブで学習中でも、定着度と回答の記録が食い違わないよう、1 つの読み取りのトランザクションで読む
 */
export function readBackupRecords(
  db: VocabDatabase = defaultDb,
): Promise<BackupRecords> {
  return db.transaction(
    'r',
    [db.progress, db.studySessions, db.reports, db.settings],
    async () => ({
      progress: await db.progress.toArray(),
      studySessions: await db.studySessions.toArray(),
      reports: await db.reports.toArray(),
      settings: (await db.settings.toArray()).filter((s) =>
        isBackedUpSettingKey(s.key),
      ),
    }),
  )
}
