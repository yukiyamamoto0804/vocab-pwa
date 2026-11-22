import { getItems } from '../../db/content'
import type { VocabDatabase } from '../../db/database'
import { listRecentSessions } from '../../db/study'
import {
  type ItemRecord,
  RATING_CODES,
  type StudySessionRecord,
} from '../../db/types'
import { type Random, shuffle } from '../../lib/random'
import { loadUnitStudySettings } from './unitStudySettings'

// ユニット学習に混ぜる単語（docs/specs/study-cards.md 6 章「ユニット学習に混ぜる単語の選び方」）

/**
 * 学習の記録の中で一度でも「忘れた」と申告した単語の id を、重複なく返す。
 * 単語ごとの最後の申告では判定しない（最後まで終えた回では「忘れた」カードを出し直すため、最後は「忘れた」にならない）。
 * excludeIds の単語（学習するユニットの単語）は除く
 */
export function forgottenItemIds(
  sessions: readonly Pick<StudySessionRecord, 'itemIds' | 'ratings'>[],
  excludeIds: ReadonlySet<string>,
): string[] {
  const ids = new Set<string>()
  for (const { itemIds, ratings } of sessions)
    itemIds.forEach((id, i) => {
      if (ratings[i] === RATING_CODES.forgot && !excludeIds.has(id)) ids.add(id)
    })
  return [...ids]
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
