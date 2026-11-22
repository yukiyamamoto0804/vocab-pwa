import { getItems, getProgressMap } from '../../db/content'
import { db as defaultDb, type VocabDatabase } from '../../db/database'
import { lastTestSetting, lastUnitStudySetting } from '../../db/settings'
import {
  getSession,
  getStoredInProgress,
  type InProgressStudy,
  isSettingBefore,
  type SettingBefore,
} from '../../db/study'
import type {
  Face,
  ItemRecord,
  ProgressRecord,
  SettingRecord,
  StudySessionRecord,
} from '../../db/types'
import { frontSenseCandidates, hasFaceData } from '../cards/faces'
import { type Deck, isFinished, replayDeck } from './deck'
import { answersOf } from './sessionRecord'
import { buildStudyQuery, type StudyQuery } from './studyQuery'

// 途中でやめた学習の再開（docs/specs/study-cards.md 5 章「途中から再開する」）

/** 同じ学習かを見分けるキー。モード・ユニット・テストや復習の条件・表面の種類で決まる */
export function studyKeyOf(query: StudyQuery): string {
  return buildStudyQuery(query)
}

/**
 * 最初の回答と一緒に書く設定（前回学習したユニット・前回テストした範囲）を作る関数。書くものがなければ undefined。
 * 回答をすべて取り消したら、書き換える前の値に戻す
 */
export function firstAnswerSettingsOf(
  query: StudyQuery,
): ((at: number) => SettingRecord[]) | undefined {
  switch (query.mode) {
    case 'unit':
      return (at) => [
        lastUnitStudySetting(query.packId, {
          at,
          unitId: query.unitId,
        }),
      ]
    case 'test':
      return (at) => [
        lastTestSetting(query.packId, {
          at,
          fromUnit: query.fromUnit,
          toUnit: query.toUnit,
        }),
      ]
    case 'review':
      return undefined
  }
}

/** 再開できる途中の学習 */
export interface Resumable {
  session: StudySessionRecord
  /** 出題の最初の並びどおりの単語 */
  items: ItemRecord[]
  progress: Map<string, ProgressRecord>
  priors: (ProgressRecord | undefined)[]
  before: SettingBefore[]
  frontSenses: Map<string, number>
  /** やめたときの出題の進み具合 */
  deck: Deck
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

/** 保存した途中の学習の形を確かめる。形が違えば（古い版で保存した・壊れているなど）undefined */
export function parseInProgress(value: unknown): InProgressStudy | undefined {
  if (!isRecord(value)) return undefined
  const { key, sessionId, order, frontSenses, priors, before } = value
  if (typeof key !== 'string' || typeof sessionId !== 'string') return undefined
  if (!isStringArray(order) || new Set(order).size !== order.length)
    return undefined
  if (
    !isRecord(frontSenses) ||
    !Object.values(frontSenses).every((i) => Number.isInteger(i))
  )
    return undefined
  if (!Array.isArray(priors) || !priors.every((p) => p === null || isRecord(p)))
    return undefined
  if (!Array.isArray(before) || !before.every(isSettingBefore)) return undefined
  return value as unknown as InProgressStudy
}

/** 回答する前の学習状況として使える値か（その単語のもので、定着度が数） */
function isPriorOf(
  prior: ProgressRecord | null,
  packId: string,
  itemId: string,
): boolean {
  return (
    prior === null ||
    (prior.packId === packId &&
      prior.itemId === itemId &&
      typeof prior.mastery === 'number' &&
      Number.isFinite(prior.mastery) &&
      typeof prior.lastReviewedAt === 'number' &&
      isRecord(prior.lastReviewedAtByFace))
  )
}

/**
 * 途中の学習と回答の記録が、互いに食い違わず、まだ終わっていないものなら、やめたときの出題の進み具合を返す。
 * 再開できなければ undefined
 */
export function resumableDeck(
  inProgress: InProgressStudy,
  session: StudySessionRecord,
  packId: string,
): Deck | undefined {
  if (session.id !== inProgress.sessionId || session.packId !== packId)
    return undefined
  const n = session.itemIds.length
  if (
    n === 0 ||
    inProgress.priors.length !== n ||
    session.ratings.length !== n ||
    session.seconds.length !== n
  )
    return undefined
  if (
    !session.itemIds.every((id, i) =>
      isPriorOf(inProgress.priors[i], packId, id),
    )
  )
    return undefined
  const deck = replayDeck(inProgress.order, answersOf(session))
  return deck && !isFinished(deck) ? deck : undefined
}

/**
 * 条件 query の学習に、再開できる途中の学習があれば返す。
 * 違う学習のもの・終わったもの・単語が教材からなくなったもの・形が違うものは、再開できない（undefined）
 */
export async function loadResumable(
  query: StudyQuery,
  db: VocabDatabase = defaultDb,
): Promise<Resumable | undefined> {
  const { packId, face } = query
  const inProgress = parseInProgress(await getStoredInProgress(packId, db))
  if (!inProgress || inProgress.key !== studyKeyOf(query)) return undefined
  const session = await getSession(inProgress.sessionId, db)
  if (!session) return undefined
  const deck = resumableDeck(inProgress, session, packId)
  if (!deck) return undefined
  const items = await getItems(packId, inProgress.order, db)
  // 取り込み直して単語や表面に必要なデータがなくなったら、続きからは再開できない
  if (
    items.length !== inProgress.order.length ||
    !items.every((item) => hasFaceData(item, face))
  )
    return undefined
  return {
    session,
    items,
    progress: await getProgressMap(packId, inProgress.order, db),
    priors: inProgress.priors.map((p) => p ?? undefined),
    before: inProgress.before,
    frontSenses: frontSensesOf(inProgress.frontSenses, items, face),
    deck,
  }
}

/**
 * 保存した表面の用法のうち、今の単語で表面に使える位置だけを残す。
 * 取り込み直して使えなくなった単語は残さず、学習の画面で選び直す
 */
function frontSensesOf(
  stored: Record<string, number>,
  items: ItemRecord[],
  face: Face,
): Map<string, number> {
  const map = new Map<string, number>()
  if (face !== 'ja' && face !== 'example-audio') return map
  for (const item of items) {
    const i = stored[item.id]
    if (i !== undefined && frontSenseCandidates(item, face).includes(i))
      map.set(item.id, i)
  }
  return map
}
