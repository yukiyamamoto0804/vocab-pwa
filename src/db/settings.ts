import { db as defaultDb, type VocabDatabase } from './database'

// アプリの状態（settings テーブル）の読み書き

/** パックごとの、最後にしたテスト（docs/specs/study-cards.md 6 章「テストの範囲と出題数」） */
export interface LastTest {
  /** テストした日時（エポックミリ秒） */
  at: number
  fromUnit: number
  toUnit: number
}

/** パックごとの、最後にしたユニット学習（docs/specs/study-cards.md 6 章「前回学習したユニットの表示」） */
export interface LastUnitStudy {
  /** 学習した日時（エポックミリ秒） */
  at: number
  unitId: number
}

const lastTestKey = (packId: string) => `lastTest:${packId}`
const lastUnitStudyKey = (packId: string) => `lastUnitStudy:${packId}`

/**
 * 保存した値が、指定したキーをすべて数で持つオブジェクトなら、そのキーだけを取り出して返す。
 * 形が違う値（古い版で保存したもの、など）は無いものとして undefined を返す
 */
async function getNumberRecord<K extends string>(
  key: string,
  fields: readonly K[],
  db: VocabDatabase,
): Promise<Record<K, number> | undefined> {
  const value = (await db.settings.get(key))?.value
  if (typeof value !== 'object' || value === null) return undefined
  const stored = value as Record<string, unknown>
  const record: Partial<Record<K, number>> = {}
  for (const field of fields) {
    const v = stored[field]
    if (typeof v !== 'number') return undefined
    record[field] = v
  }
  return record as Record<K, number>
}

export function getLastTest(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<LastTest | undefined> {
  return getNumberRecord(lastTestKey(packId), ['at', 'fromUnit', 'toUnit'], db)
}

export async function saveLastTest(
  packId: string,
  lastTest: LastTest,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: lastTestKey(packId), value: lastTest })
}

export function getLastUnitStudy(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<LastUnitStudy | undefined> {
  return getNumberRecord(lastUnitStudyKey(packId), ['at', 'unitId'], db)
}

export async function saveLastUnitStudy(
  packId: string,
  lastUnitStudy: LastUnitStudy,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: lastUnitStudyKey(packId), value: lastUnitStudy })
}
