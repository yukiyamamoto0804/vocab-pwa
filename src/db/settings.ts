import { db as defaultDb, type VocabDatabase } from './database'

// アプリの状態（settings テーブル）の読み書き

/** パックごとの、最後にしたテスト（docs/specs/study-cards.md 6 章「テストの範囲と出題数」） */
export interface LastTest {
  /** テストした日時（エポックミリ秒） */
  at: number
  fromUnit: number
  toUnit: number
}

const lastTestKey = (packId: string) => `lastTest:${packId}`

export async function getLastTest(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<LastTest | undefined> {
  const value = (await db.settings.get(lastTestKey(packId)))?.value
  // 形が違う値（古い版で保存したもの、など）は無いものとして扱う
  if (
    typeof value === 'object' &&
    value !== null &&
    'at' in value &&
    'fromUnit' in value &&
    'toUnit' in value &&
    typeof value.at === 'number' &&
    typeof value.fromUnit === 'number' &&
    typeof value.toUnit === 'number'
  )
    return { at: value.at, fromUnit: value.fromUnit, toUnit: value.toUnit }
  return undefined
}

export async function saveLastTest(
  packId: string,
  lastTest: LastTest,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: lastTestKey(packId), value: lastTest })
}
