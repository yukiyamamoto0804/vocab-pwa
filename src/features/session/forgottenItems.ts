import { getItems } from '../../db/content'
import type { VocabDatabase } from '../../db/database'
import { listRecentSessions } from '../../db/study'
import {
  type ItemRecord,
  RATING_CODES,
  type StudySessionRecord,
} from '../../db/types'
import { type Random, shuffle } from '../../lib/random'
import { type StudyCount, takeCount } from './studyCount'
import { loadUnitStudySettings } from './unitStudySettings'

// 直前の数回の学習で忘れた単語（docs/specs/study-cards.md 6 章「直前の数回の学習で忘れた単語」）。
// ユニット学習に混ぜる単語と、復習で使う

/**
 * 忘れたままの単語の id を、重複なく返す。sessions は新しい順。
 * 新しい回から見て、単語ごとに最初に決まった結果を使う。
 * - その回で一度でも「忘れた」と申告していれば、対象にする
 * - 「忘れた」と申告せず「覚えた」と答えていれば、克服したものとして対象にしない
 * - 「曖昧」だけなら、まだ克服していないとして、それより前の回で決める
 * 単語ごとの最後の申告では判定しない（最後まで終えた回では「忘れた」カードを出し直すため、最後は「忘れた」にならない）。
 * excludeIds の単語（学習するユニットの単語）は除く
 */
export function forgottenItemIds(
  sessions: readonly Pick<StudySessionRecord, 'itemIds' | 'ratings'>[],
  excludeIds: ReadonlySet<string> = new Set(),
): string[] {
  /** 新しい回から見て、すでに判定した単語 */
  const decided = new Set<string>()
  const forgotten: string[] = []
  for (const { itemIds, ratings } of sessions) {
    /** この回で決まった単語 → 「忘れた」があったか（「曖昧」だけの単語は入れない） */
    const here = new Map<string, boolean>()
    itemIds.forEach((id, i) => {
      if (decided.has(id)) return
      if (ratings[i] === RATING_CODES.forgot) here.set(id, true)
      else if (ratings[i] === RATING_CODES.remembered && !here.has(id))
        here.set(id, false)
    })
    for (const [id, forgot] of here) {
      decided.add(id)
      if (forgot && !excludeIds.has(id)) forgotten.push(id)
    }
  }
  return forgotten
}

/** 候補から、混ぜる単語をランダムに count 個まで選ぶ */
export function selectMixItems<T>(
  candidates: readonly T[],
  count: number,
  random?: Random,
): T[] {
  return shuffle(candidates, random).slice(0, count)
}

/**
 * ユニット学習に混ぜる単語を、共通の設定に従って読み込んで選ぶ。
 * unitItemIds は学習するユニットの単語（候補から除く）
 */
export async function loadMixItems(
  packId: string,
  unitItemIds: ReadonlySet<string>,
  { db, random }: { db?: VocabDatabase; random?: Random } = {},
): Promise<ItemRecord[]> {
  const { mixCount, mixSessionRange } = await loadUnitStudySettings(db)
  if (mixCount === 0) return []
  const sessions = await listRecentSessions(packId, mixSessionRange, db)
  const candidates = await getItems(
    packId,
    forgottenItemIds(sessions, unitItemIds),
    db,
  )
  // 手順 8 で表面の種類を増やしたら、必要なデータがない単語は候補から（選ぶ前に）除く
  return selectMixItems(candidates, mixCount, random)
}

/**
 * 復習で出す単語を、ランダムな順で出題数まで選ぶ。
 * items は、表面に必要なデータがない単語を除いた後のもの（手順 8）
 */
export function selectReviewItems<T>(
  items: readonly T[],
  count: StudyCount,
  random?: Random,
): T[] {
  return takeCount(shuffle(items, random), count)
}

/** 復習で出す単語（直前 sessionCount 回の学習で忘れた単語すべて）を読み込む。並びは記録の順のまま */
export async function loadReviewItems(
  packId: string,
  sessionCount: number,
  db?: VocabDatabase,
): Promise<ItemRecord[]> {
  const sessions = await listRecentSessions(packId, sessionCount, db)
  return getItems(packId, forgottenItemIds(sessions), db)
}
