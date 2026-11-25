import Dexie from 'dexie'
import { randomId } from '../lib/random'
import { db as defaultDb, type VocabDatabase } from './database'
import {
  type ProgressRecord,
  RECORD_ONLY_FACES,
  type SettingRecord,
  type StudySessionRecord,
} from './types'

// 学習中の書き込み。回答の記録と学習状況は、片方だけが書かれて食い違わないよう
// 1 つのトランザクションで書く（docs/ARCHITECTURE.md 5 章）。

/** 書き換える前の設定の値。existed が false なら、設定はなかった */
export interface SettingBefore {
  key: string
  existed: boolean
  value: unknown
}

/**
 * 途中の学習（docs/specs/study-cards.md 5 章「途中から再開する」）。settings にパックごとに 1 つ置く。
 * 出題の進み具合と申告の回数は、最初の並びに回答の記録を当てはめて求める
 */
export interface InProgressStudy {
  /** 学習の条件（モード・ユニット・テストや復習の条件・表面の種類）。同じ学習かを見分ける */
  key: string
  /** 回答の記録（studySessions）の id */
  sessionId: string
  /** 出題の最初の並び */
  order: string[]
  /** 表面に例文を使う種類で、単語ごとに表面に使う用法 */
  frontSenses: Record<string, number>
  /** 回答ごとの、回答する前の学習状況（初めての回答なら null）。「1 つ戻す」で戻すため */
  priors: (ProgressRecord | null)[]
  /** 最初の回答で書き換えた設定（前回の学習など）の、書き換える前の値。回答をすべて取り消したら戻す */
  before: SettingBefore[]
}

export const inProgressKey = (packId: string) => `inProgress:${packId}`

/** 書き換える前の設定の値として使える形か（DB から読んだ値を確かめる） */
export function isSettingBefore(v: unknown): v is SettingBefore {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).key === 'string' &&
    typeof (v as Record<string, unknown>).existed === 'boolean'
  )
}

/** 保存した途中の学習を、確かめずにそのまま返す。確かめるのは features/session/inProgress.ts */
export async function getStoredInProgress(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<unknown> {
  return (await db.settings.get(inProgressKey(packId)))?.value
}

/** 学習 1 回分の回答の記録。なければ undefined */
export function getSession(
  id: string,
  db: VocabDatabase = defaultDb,
): Promise<StudySessionRecord | undefined> {
  return db.studySessions.get(id)
}

/**
 * 回答を追記した記録と、更新した学習状況と、途中の学習を保存する。
 * inProgress が undefined なら（最後まで終えたなら）途中の学習を消す。
 * この回の途中の学習がまだ保存されていなければ（最初の回答なら）firstAnswerSettings も書く。
 * 書き換える前の値を返す（途中の学習の before には、渡した値ではなくこの値を書く）
 */
export async function saveAnswer(
  answer: {
    session: StudySessionRecord
    /** 更新した学習状況。記録だけを残す表面（RECORD_ONLY_FACES）では渡さない */
    progress: ProgressRecord | undefined
    inProgress: InProgressStudy | undefined
    firstAnswerSettings?: SettingRecord[]
  },
  db: VocabDatabase = defaultDb,
): Promise<SettingBefore[]> {
  const { session, progress, inProgress, firstAnswerSettings = [] } = answer
  return db.transaction(
    'rw',
    [db.studySessions, db.progress, db.settings],
    async () => {
      await db.studySessions.put(session)
      if (progress) await db.progress.put(progress)
      // この回の途中の学習がすでに保存されていれば、その「書き換える前の値」を引き継ぐ。
      // なければ最初の回答として、設定を書き換える前の値を読んでから書く。
      // 画面から渡された記録の長さで判定しないのは、保存できたのに失敗が返って同じ回答をもう一度送ったとき、
      // 書き換えた後の値を「前の値」として読んでしまわないようにするため
      const stored: unknown = (
        await db.settings.get(inProgressKey(session.packId))
      )?.value
      let before: SettingBefore[]
      if (
        typeof stored === 'object' &&
        stored !== null &&
        'sessionId' in stored &&
        stored.sessionId === session.id &&
        'before' in stored &&
        Array.isArray(stored.before) &&
        stored.before.every(isSettingBefore)
      ) {
        before = stored.before
      } else {
        before = []
        for (const setting of firstAnswerSettings) {
          const current = await db.settings.get(setting.key)
          before.push({
            key: setting.key,
            existed: current !== undefined,
            value: current?.value,
          })
          await db.settings.put(setting)
        }
      }
      if (inProgress)
        await db.settings.put({
          key: inProgressKey(session.packId),
          value: { ...inProgress, before },
        })
      else await db.settings.delete(inProgressKey(session.packId))
      return before
    },
  )
}

/**
 * 直前の回答を取り消し、回答する前の状態に戻す。
 * previousSession に回答が 1 つもなければ、学習 1 回分の記録と途中の学習を消し、
 * 最初の回答で書き換えた設定を inProgress.before の値に戻す（学習しなかったことにする）。
 * previousProgress がなければ（初めての回答だったなら）、学習状況を消す。
 */
export async function restoreBeforeAnswer(
  previous: {
    session: StudySessionRecord
    itemId: string
    progress: ProgressRecord | undefined
    inProgress: InProgressStudy
  },
  db: VocabDatabase = defaultDb,
): Promise<void> {
  const { session, itemId, progress, inProgress } = previous
  await db.transaction(
    'rw',
    [db.studySessions, db.progress, db.settings],
    async () => {
      if (session.itemIds.length === 0) {
        await db.studySessions.delete(session.id)
        await db.settings.delete(inProgressKey(session.packId))
        for (const b of inProgress.before) {
          if (b.existed) await db.settings.put({ key: b.key, value: b.value })
          else await db.settings.delete(b.key)
        }
      } else {
        await db.studySessions.put(session)
        await db.settings.put({
          key: inProgressKey(session.packId),
          value: inProgress,
        })
      }

      // 記録だけを残す表面では学習状況を書いていないので、戻さない
      if (RECORD_ONLY_FACES.includes(session.face)) return
      if (progress) await db.progress.put(progress)
      else await db.progress.delete([session.packId, itemId])
    },
  )
}

/**
 * パックの学習の記録を、新しい順に、復習以外の回が count 回分になるまで返す。
 * パックと日時の索引で、そのパックの記録だけを読む。
 * 復習の回は回数に数えないが、その間にある復習の回も返す（docs/specs/study-cards.md 6 章「直前の数回の学習で忘れた単語」）。
 * 記録だけを残す表面の回（自動で進める学習。RECORD_ONLY_FACES）は、返さず、回数にも数えない（11 章）
 */
export async function listRecentSessions(
  packId: string,
  count: number,
  db: VocabDatabase = defaultDb,
): Promise<StudySessionRecord[]> {
  const sessions: StudySessionRecord[] = []
  let counted = 0
  if (!Number.isInteger(count) || count <= 0) return sessions
  await db.studySessions
    .where('[packId+startedAt]')
    .between([packId, Dexie.minKey], [packId, Dexie.maxKey])
    .reverse()
    // until は次の記録を each に渡す前に判定され、止めた記録は返らない（count 回目の直後で止まる）
    .until(() => counted >= count)
    .each((session) => {
      if (RECORD_ONLY_FACES.includes(session.face)) return
      sessions.push(session)
      if (session.mode !== 'review') counted += 1
    })
  return sessions
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
    await db.reports.add({ id: randomId(), at, packId, itemId })
    return true
  })
}
