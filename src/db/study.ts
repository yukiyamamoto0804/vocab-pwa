import { db as defaultDb, type VocabDatabase } from './database'
import type { ProgressRecord, StudySessionRecord } from './types'

// 学習中の書き込み。回答の記録と学習状況は、片方だけが書かれて食い違わないよう
// 1 つのトランザクションで書く（docs/ARCHITECTURE.md 5 章）。

/** 回答を追記した記録と、更新した学習状況を保存する */
export async function saveAnswer(
  session: StudySessionRecord,
  progress: ProgressRecord,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.transaction('rw', [db.studySessions, db.progress], async () => {
    await db.studySessions.put(session)
    await db.progress.put(progress)
  })
}

/**
 * 直前の回答を取り消し、回答する前の状態に戻す。
 * previousSession に回答が 1 つもなければ、学習 1 回分の記録ごと消す。
 * previousProgress がなければ（初めての回答だったなら）、学習状況を消す。
 */
export async function restoreBeforeAnswer(
  previousSession: StudySessionRecord,
  itemKey: { packId: string; itemId: string },
  previousProgress: ProgressRecord | undefined,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.transaction('rw', [db.studySessions, db.progress], async () => {
    if (previousSession.itemIds.length === 0)
      await db.studySessions.delete(previousSession.id)
    else await db.studySessions.put(previousSession)

    if (previousProgress) await db.progress.put(previousProgress)
    else await db.progress.delete([itemKey.packId, itemKey.itemId])
  })
}

/** 報告済みの単語の id */
export async function listReportedItemIds(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<Set<string>> {
  const records = await db.reports.where('packId').equals(packId).toArray()
  return new Set(records.map((r) => r.itemId))
}

/**
 * 単語の「解説の誤り」の報告を切り替える（docs/specs/study-cards.md 10 章）。
 * 報告がなければ追加し、あれば取り消す。戻り値は切り替えた後に報告済みかどうか。
 */
export async function toggleReport(
  packId: string,
  itemId: string,
  at: number,
  db: VocabDatabase = defaultDb,
): Promise<boolean> {
  return db.transaction('rw', db.reports, async () => {
    const existing = db.reports
      .where('[packId+itemId]')
      .equals([packId, itemId])
    if ((await existing.count()) > 0) {
      await existing.delete()
      return false
    }
    await db.reports.add({ id: crypto.randomUUID(), at, packId, itemId })
    return true
  })
}
