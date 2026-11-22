import {
  db as defaultDb,
  notifyRecordsReplaced,
  type VocabDatabase,
} from './database'
import { isBackedUpSettingKey } from './settings'
import { inProgressKey } from './study'
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

/** 端末の学習記録の件数（インポートの確認の画面に出す） */
export interface RecordCounts {
  studySessions: number
  progress: number
  reports: number
}

export function countBackupRecords(
  db: VocabDatabase = defaultDb,
): Promise<RecordCounts> {
  return db.transaction(
    'r',
    [db.progress, db.studySessions, db.reports],
    async () => ({
      studySessions: await db.studySessions.count(),
      progress: await db.progress.count(),
      reports: await db.reports.count(),
    }),
  )
}

/**
 * 端末の学習記録を、確かめ済みの記録で置き換える（docs/specs/backup.md 6 章）。
 * 途中で失敗したら何も変わらないよう、1 つのトランザクションで行う。教材のテーブルには触れない。
 * settings は、ファイルに含めるキーと途中でやめた学習だけを消し、端末ごとの値（lastExport など）は残す。
 * 置き換える前と後に、ほかのタブに書き込みをやめて開き直すよう知らせる
 */
export async function replaceBackupRecords(
  records: BackupRecords,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  const inProgressPrefix = inProgressKey('')
  // 置き換える前にも知らせ、ほかのタブに先に書き込みをやめさせる
  // （置き換えた後だけだと、届くまでの間に古い回答を書き戻す余地が残るため）
  notifyRecordsReplaced()
  await db.transaction(
    'rw',
    [db.progress, db.studySessions, db.reports, db.settings],
    async () => {
      await Promise.all([
        db.progress.clear(),
        db.studySessions.clear(),
        db.reports.clear(),
        db.settings
          .filter(
            (s) =>
              isBackedUpSettingKey(s.key) || s.key.startsWith(inProgressPrefix),
          )
          .delete(),
      ])
      await db.progress.bulkAdd(records.progress)
      await db.studySessions.bulkAdd(records.studySessions)
      await db.reports.bulkAdd(records.reports)
      await db.settings.bulkAdd(records.settings)
    },
  )
  notifyRecordsReplaced()
}
