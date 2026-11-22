import type { VocabDatabase } from '../../db/database'
import {
  getStoredUnitStudySettings,
  type UnitStudySettings,
} from '../../db/settings'
import { studyConfig } from '../studyConfig'

// ユニット学習の共通の設定（docs/specs/study-cards.md 7 章）

/** 範囲内の整数ならその値、そうでなければ初期値 */
function inRange(
  value: unknown,
  {
    min,
    max,
    default: fallback,
  }: { min: number; max: number; default: number },
): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback
}

/** 保存した値を設定にする。保存していない・範囲外・形の違う項目は、その項目だけ初期値にする */
export function normalizeUnitStudySettings(value: unknown): UnitStudySettings {
  const stored: Record<string, unknown> =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  return {
    mixCount: inRange(stored.mixCount, studyConfig.mixCount),
    mixSessionRange: inRange(
      stored.mixSessionRange,
      studyConfig.mixSessionRange,
    ),
  }
}

export async function loadUnitStudySettings(
  db?: VocabDatabase,
): Promise<UnitStudySettings> {
  return normalizeUnitStudySettings(await getStoredUnitStudySettings(db))
}
