import { db as defaultDb, type VocabDatabase } from './database'
import { FACES, type Face, type SettingRecord } from './types'

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
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined
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

/** 最後にしたテストの設定の行。学習の最初の回答と一緒に書く（db/study.ts の saveAnswer） */
export function lastTestSetting(
  packId: string,
  lastTest: LastTest,
): SettingRecord {
  return { key: lastTestKey(packId), value: lastTest }
}

export function getLastUnitStudy(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<LastUnitStudy | undefined> {
  return getNumberRecord(lastUnitStudyKey(packId), ['at', 'unitId'], db)
}

/** 最後にしたユニット学習の設定の行。学習の最初の回答と一緒に書く（db/study.ts の saveAnswer） */
export function lastUnitStudySetting(
  packId: string,
  lastUnitStudy: LastUnitStudy,
): SettingRecord {
  return { key: lastUnitStudyKey(packId), value: lastUnitStudy }
}

/** ユニット学習の共通の設定（docs/specs/study-cards.md 7 章）。アプリ全体で 1 つ */
export interface UnitStudySettings {
  /** 混ぜる単語の数の上限 */
  mixCount: number
  /** 混ぜる単語の対象範囲（直前の何回の学習か） */
  mixSessionRange: number
}

const UNIT_STUDY_KEY = 'unitStudy'

/**
 * 保存したユニット学習の設定を、確かめずにそのまま返す（保存していなければ undefined）。
 * 選べる範囲は設定値（features/studyConfig.ts）で決まるため、確かめるのは features/session/unitStudySettings.ts
 */
export async function getStoredUnitStudySettings(
  db: VocabDatabase = defaultDb,
): Promise<unknown> {
  return (await db.settings.get(UNIT_STUDY_KEY))?.value
}

export async function saveUnitStudySettings(
  settings: UnitStudySettings,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: UNIT_STUDY_KEY, value: settings })
}

const FACE_KEY = 'face'

/** 前回選んだ表面の種類（docs/specs/study-cards.md 7 章）。アプリ全体で 1 つ。保存していない・不明な値なら undefined */
export async function getLastFace(
  db: VocabDatabase = defaultDb,
): Promise<Face | undefined> {
  const value = (await db.settings.get(FACE_KEY))?.value
  return FACES.find((face) => face === value)
}

export async function saveLastFace(
  face: Face,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: FACE_KEY, value: face })
}

const EXAMPLE_TEXT_SHOWN_KEY = 'exampleTextShown'

/**
 * 例文の音声 → 解説で、空欄の英文を最初から表示するか（docs/specs/study-cards.md 3 章）。アプリ全体で 1 つ。
 * 保存していない・形の違う値なら false（ボタンを押して表示する）
 */
export async function getExampleTextShown(
  db: VocabDatabase = defaultDb,
): Promise<boolean> {
  return (await db.settings.get(EXAMPLE_TEXT_SHOWN_KEY))?.value === true
}

export async function saveExampleTextShown(
  shown: boolean,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: EXAMPLE_TEXT_SHOWN_KEY, value: shown })
}

/**
 * 学習記録のファイルに含める設定のキーか（docs/specs/backup.md 3 章）。
 * 途中でやめた学習（inProgress:<packId>）と、端末ごとの値（lastExport など）は含めない
 */
export function isBackedUpSettingKey(key: string): boolean {
  return (
    key === FACE_KEY ||
    key === UNIT_STUDY_KEY ||
    key === EXAMPLE_TEXT_SHOWN_KEY ||
    key.startsWith(lastTestKey('')) ||
    key.startsWith(lastUnitStudyKey(''))
  )
}

const LAST_EXPORT_KEY = 'lastExport'

/** 学習記録を最後にエクスポートした日時（docs/specs/backup.md 5 章）。保存していない・形の違う値なら undefined */
export async function getLastExport(
  db: VocabDatabase = defaultDb,
): Promise<number | undefined> {
  const value = (await db.settings.get(LAST_EXPORT_KEY))?.value
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export async function saveLastExport(
  at: number,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: LAST_EXPORT_KEY, value: at })
}
