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
 * 値が、指定したキーをすべて数で持つオブジェクトなら、そのキーだけを取り出して返す。
 * 形が違う値（古い版で保存したもの、など）は無いものとして undefined を返す
 */
function pickNumberRecord<K extends string>(
  value: unknown,
  fields: readonly K[],
): Record<K, number> | undefined {
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

/** 最後にしたテストの値として使える形なら取り出す。形が違えば undefined */
export function parseLastTest(value: unknown): LastTest | undefined {
  return pickNumberRecord(value, ['at', 'fromUnit', 'toUnit'])
}

export async function getLastTest(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<LastTest | undefined> {
  return parseLastTest((await db.settings.get(lastTestKey(packId)))?.value)
}

/** 最後にしたテストの設定の行。学習の最初の回答と一緒に書く（db/study.ts の saveAnswer） */
export function lastTestSetting(
  packId: string,
  lastTest: LastTest,
): SettingRecord {
  return { key: lastTestKey(packId), value: lastTest }
}

/** 最後にしたユニット学習の値として使える形なら取り出す。形が違えば undefined */
export function parseLastUnitStudy(value: unknown): LastUnitStudy | undefined {
  return pickNumberRecord(value, ['at', 'unitId'])
}

export async function getLastUnitStudy(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<LastUnitStudy | undefined> {
  return parseLastUnitStudy(
    (await db.settings.get(lastUnitStudyKey(packId)))?.value,
  )
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
 * 「例文の音声」で、空欄の英文を最初から表示するか（docs/specs/study-cards.md 3 章）。アプリ全体で 1 つ。
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

/** 学習記録のファイルに含める設定の種類 */
export type BackedUpSettingKind =
  | 'face'
  | 'unitStudy'
  | 'exampleTextShown'
  | 'frontSense'
  | 'playbackRate'
  | 'lastTest'
  | 'lastUnitStudy'

/**
 * 学習記録のファイルに含める設定のキーなら、その種類を返す（docs/specs/backup.md 3 章）。
 * 途中でやめた学習（inProgress:<packId>）と、端末ごとの値（lastExport など）は含めないので undefined
 */
export function backedUpSettingKind(
  key: string,
): BackedUpSettingKind | undefined {
  if (key === FACE_KEY) return 'face'
  if (key === UNIT_STUDY_KEY) return 'unitStudy'
  if (key === EXAMPLE_TEXT_SHOWN_KEY) return 'exampleTextShown'
  if (key === FRONT_SENSE_KEY) return 'frontSense'
  if (key === PLAYBACK_RATE_KEY) return 'playbackRate'
  if (key.startsWith(lastTestKey(''))) return 'lastTest'
  if (key.startsWith(lastUnitStudyKey(''))) return 'lastUnitStudy'
  return undefined
}

export function isBackedUpSettingKey(key: string): boolean {
  return backedUpSettingKind(key) !== undefined
}

/**
 * 表面に例文を使う種類（「例文の訳」、「例文の音声」）で、用法が複数ある単語の例文の選び方
 * （docs/specs/study-cards.md 4 章）。first: 使える用法のうちいちばん前のもの、random: 使える用法からランダム
 */
export const FRONT_SENSE_CHOICES = ['random', 'first'] as const
export type FrontSenseChoice = (typeof FRONT_SENSE_CHOICES)[number]

const FRONT_SENSE_KEY = 'frontSense'

/** 例文の選び方を取り出す。形が違えば undefined */
export function parseFrontSenseChoice(
  value: unknown,
): FrontSenseChoice | undefined {
  return FRONT_SENSE_CHOICES.find((c) => c === value)
}

/** 例文の選び方。アプリ全体で 1 つ。保存していない・形の違う値なら random（初期値） */
export async function getFrontSenseChoice(
  db: VocabDatabase = defaultDb,
): Promise<FrontSenseChoice> {
  return (
    parseFrontSenseChoice((await db.settings.get(FRONT_SENSE_KEY))?.value) ??
    'random'
  )
}

export async function saveFrontSenseChoice(
  choice: FrontSenseChoice,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: FRONT_SENSE_KEY, value: choice })
}

/** 音声を流す速さの選択肢（docs/specs/study-cards.md 9 章） */
export const PLAYBACK_RATES = [0.8, 0.9, 1, 1.1, 1.2] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

const PLAYBACK_RATE_KEY = 'playbackRate'

/** 音声の速さを取り出す。形が違えば undefined */
export function parsePlaybackRate(value: unknown): PlaybackRate | undefined {
  return PLAYBACK_RATES.find((r) => r === value)
}

/** 音声の速さ。アプリ全体で 1 つ。保存していない・形の違う値なら 1（等速） */
export async function getPlaybackRate(
  db: VocabDatabase = defaultDb,
): Promise<PlaybackRate> {
  return (
    parsePlaybackRate((await db.settings.get(PLAYBACK_RATE_KEY))?.value) ?? 1
  )
}

export async function savePlaybackRate(
  rate: PlaybackRate,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: PLAYBACK_RATE_KEY, value: rate })
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

/** エクスポートの選び方（docs/specs/backup.md 2 章） */
export const EXPORT_KINDS = ['records-and-packs', 'records', 'packs'] as const
export type ExportKind = (typeof EXPORT_KINDS)[number]

/** 前回のエクスポートの選び方と選んだパック。端末ごとの値で、学習記録のファイルには含めない */
export interface ExportChoice {
  kind: ExportKind
  /** 選んだパック */
  packIds: string[]
  /** エクスポートした時点で取り込んであったパック（後で取り込んだパックを見分けるため） */
  knownPackIds: string[]
}

const EXPORT_CHOICE_KEY = 'exportChoice'

/** 保存した選び方を、確かめずにそのまま返す。確かめるのは features/backup/exportChoice.ts */
export async function getStoredExportChoice(
  db: VocabDatabase = defaultDb,
): Promise<unknown> {
  return (await db.settings.get(EXPORT_CHOICE_KEY))?.value
}

export async function saveExportChoice(
  choice: ExportChoice,
  db: VocabDatabase = defaultDb,
): Promise<void> {
  await db.settings.put({ key: EXPORT_CHOICE_KEY, value: choice })
}
