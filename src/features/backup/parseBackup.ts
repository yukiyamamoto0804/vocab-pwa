import {
  backedUpSettingKind,
  parseFrontSenseChoice,
  parseLastTest,
  parseLastUnitStudy,
  parsePlaybackRate,
} from '../../db/settings'
import {
  FACES,
  type ProgressRecord,
  RATING_CODES,
  type ReportRecord,
  type SettingRecord,
  STUDY_MODES,
  type StudySessionRecord,
} from '../../db/types'
import { normalizeUnitStudySettings } from '../session/unitStudySettings'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type RecordsBackup,
} from './recordsFile'

// 学習記録のファイルの確かめ（docs/specs/backup.md 7 章）。
// どれか 1 つでも合わなければ、何も読み込まずに止める（一部だけ読み込むことはしない）

/** 学習記録のファイルの大きさの上限（バイト） */
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024

/** 一度に知らせる誤りの数の上限。壊れたファイルで誤りが何万件も並ばないように */
const MAX_ERRORS = 20

export type ParseBackupResult =
  | { ok: true; backup: RecordsBackup }
  | { ok: false; errors: string[] }

type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v !== ''
const isTime = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0
const includes = <T extends string>(list: readonly T[], v: unknown): v is T =>
  list.includes(v as T)

/** 教材の zip（PK で始まる）を選んだときの案内 */
export const ZIP_MESSAGE =
  '教材パック（zip）のようです。教材は「取り込み」の画面から取り込んでください。'

const RATING_CHARS = new Set<string>(Object.values(RATING_CODES))

/** 1 行を確かめた結果。使える記録、誤りの文、捨てる行（skip）のどれか */
type RowResult<T> = { record: T } | { error: string } | 'skip'

/** ファイルの中身（文字列）を確かめ、読み込める形にする */
export function parseRecordsBackup(text: string): ParseBackupResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    // 教材の zip を選んだとき（zip は PK で始まる）は、取り込みの画面を案内する
    return {
      ok: false,
      errors: [
        text.startsWith('PK')
          ? ZIP_MESSAGE
          : '学習記録のファイルとして読めませんでした（JSON ではありません）。',
      ],
    }
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT)
    return {
      ok: false,
      errors: ['このアプリの学習記録のファイルではありません。'],
    }
  const { version, exportedAt } = raw
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return {
      ok: false,
      errors: ['ファイルの版（version）が正しくありません。'],
    }
  if (version > BACKUP_VERSION)
    return {
      ok: false,
      errors: [
        'このアプリより新しい版で書き出したファイルです。アプリを更新してから読み込んでください。',
      ],
    }

  const errors: string[] = []
  if (!isTime(exportedAt)) errors.push('exportedAt: 日時ではありません')

  /** name の一覧を 1 行ずつ確かめ、使える記録だけを返す。誤りは errors に足す */
  function rows<T>(name: string, check: (row: Obj) => RowResult<T>): T[] {
    const list = (raw as Obj)[name]
    if (!Array.isArray(list)) {
      errors.push(`${name}: 一覧（配列）ではありません`)
      return []
    }
    const out: T[] = []
    for (const [i, row] of list.entries()) {
      const result = isObject(row) ? check(row) : { error: '形が違います' }
      if (result === 'skip') continue
      if ('record' in result) out.push(result.record)
      else if (errors.length < MAX_ERRORS)
        errors.push(`${name}[${i}]: ${result.error}`)
    }
    return out
  }

  const progress = rows('progress', progressChecker())
  const studySessions = rows('studySessions', sessionChecker())
  const reports = rows('reports', reportChecker())
  const settings = rows('settings', settingChecker())

  if (errors.length > 0 || !isTime(exportedAt))
    return { ok: false, errors: errors.slice(0, MAX_ERRORS) }
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      progress,
      studySessions,
      reports,
      settings,
    },
  }
}

function progressChecker(): (row: Obj) => RowResult<ProgressRecord> {
  const seen = new Set<string>()
  return ({
    packId,
    itemId,
    mastery,
    lastReviewedAt,
    lastReviewedAtByFace,
  }) => {
    if (!isNonEmptyString(packId) || !isNonEmptyString(itemId))
      return { error: 'packId・itemId がありません' }
    if (typeof mastery !== 'number' || !(mastery >= 0 && mastery <= 1))
      return { error: '定着度（mastery）が 0〜1 の数ではありません' }
    if (!isTime(lastReviewedAt))
      return { error: '最終出題日（lastReviewedAt）が日時ではありません' }
    if (
      !isObject(lastReviewedAtByFace) ||
      !Object.entries(lastReviewedAtByFace).every(
        ([face, at]) => includes(FACES, face) && isTime(at),
      )
    )
      return { error: '表面の種類ごとの最終出題日の形が違います' }
    const key = JSON.stringify([packId, itemId])
    if (seen.has(key)) return { error: '同じ単語の記録が重複しています' }
    seen.add(key)
    return {
      record: {
        packId,
        itemId,
        mastery,
        lastReviewedAt,
        lastReviewedAtByFace:
          lastReviewedAtByFace as ProgressRecord['lastReviewedAtByFace'],
      },
    }
  }
}

function sessionChecker(): (row: Obj) => RowResult<StudySessionRecord> {
  const seen = new Set<string>()
  return ({ id, packId, startedAt, mode, face, itemIds, seconds, ratings }) => {
    if (!isNonEmptyString(id) || !isNonEmptyString(packId))
      return { error: 'id・packId がありません' }
    if (!isTime(startedAt))
      return { error: '開始日時（startedAt）が日時ではありません' }
    if (!includes(STUDY_MODES, mode)) return { error: 'mode が違います' }
    if (!includes(FACES, face)) return { error: '表面の種類（face）が違います' }
    if (!Array.isArray(itemIds) || !itemIds.every(isNonEmptyString))
      return { error: '単語の id の一覧（itemIds）の形が違います' }
    if (
      !Array.isArray(seconds) ||
      !seconds.every((s) => Number.isInteger(s) && (s as number) >= 0)
    )
      return {
        error: '回答の時間（seconds）が 0 以上の整数の一覧ではありません',
      }
    if (
      typeof ratings !== 'string' ||
      ![...ratings].every((c) => RATING_CHARS.has(c))
    )
      return { error: '自己申告（ratings）に決まった文字以外があります' }
    if (itemIds.length !== seconds.length || itemIds.length !== ratings.length)
      return { error: 'itemIds・seconds・ratings の長さが合いません' }
    if (seen.has(id)) return { error: '同じ id の記録が重複しています' }
    seen.add(id)
    return {
      record: { id, packId, startedAt, mode, face, itemIds, seconds, ratings },
    }
  }
}

function reportChecker(): (row: Obj) => RowResult<ReportRecord> {
  const seenIds = new Set<string>()
  const seenItems = new Set<string>()
  return ({ id, at, packId, itemId }) => {
    if (
      !isNonEmptyString(id) ||
      !isNonEmptyString(packId) ||
      !isNonEmptyString(itemId)
    )
      return { error: 'id・packId・itemId がありません' }
    if (!isTime(at)) return { error: '報告した日時（at）が日時ではありません' }
    const item = JSON.stringify([packId, itemId])
    // 報告は 1 つの単語に 1 件の前提で扱う（db/study.ts の toggleReport）
    if (seenIds.has(id) || seenItems.has(item))
      return { error: '報告が重複しています' }
    seenIds.add(id)
    seenItems.add(item)
    return { record: { id, at, packId, itemId } }
  }
}

/**
 * 設定の値を、今の読み出しの処理と同じ決まりで確かめる。使えない形なら undefined。
 * ユニット学習の設定は、読み出しと同じく、範囲の外の項目を初期値に直して受け付ける
 * （設定値の範囲を後で狭めても、前に書き出したファイルを断らないように）
 */
function checkSettingValue(
  key: string,
  value: unknown,
): { value: unknown } | undefined {
  switch (backedUpSettingKind(key)) {
    case 'face':
      return includes(FACES, value) ? { value } : undefined
    case 'exampleTextShown':
      return typeof value === 'boolean' ? { value } : undefined
    case 'frontSense':
      return parseFrontSenseChoice(value) !== undefined ? { value } : undefined
    case 'playbackRate':
      return parsePlaybackRate(value) !== undefined ? { value } : undefined
    case 'lastTest':
      return parseLastTest(value) !== undefined ? { value } : undefined
    case 'lastUnitStudy':
      return parseLastUnitStudy(value) !== undefined ? { value } : undefined
    case 'unitStudy':
      return isObject(value)
        ? { value: normalizeUnitStudySettings(value) }
        : undefined
    case undefined:
      return undefined
  }
}

/** 知らないキーと、ファイルに含めないキー（docs/specs/backup.md 3 章）は捨てる */
function settingChecker(): (row: Obj) => RowResult<SettingRecord> {
  const seen = new Set<string>()
  return ({ key, value }) => {
    if (typeof key !== 'string') return { error: '形が違います' }
    if (backedUpSettingKind(key) === undefined) return 'skip'
    if (seen.has(key)) return { error: `同じキー（${key}）が重複しています` }
    seen.add(key)
    const checked = checkSettingValue(key, value)
    if (!checked) return { error: `${key} の値の形が違います` }
    return { record: { key, value: checked.value } }
  }
}
