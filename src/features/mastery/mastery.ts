import type { Face, ProgressRecord, Rating } from '../../db/types'
import { studyConfig } from '../studyConfig'

// 定着度の更新（docs/specs/study-cards.md 6 章「定着度」）

/** 自己申告を数値にしたもの（式の y_t） */
const RATING_VALUES: Record<Rating, number> = {
  remembered: 1,
  unsure: 0.5,
  forgot: 0,
}

/** x_t = λ・y_t + (1 − λ)・x_{t−1}。初回は y_t そのもの */
export function nextMastery(
  previous: number | undefined,
  rating: Rating,
  lambda: number = studyConfig.masteryLambda,
): number {
  const y = RATING_VALUES[rating]
  return previous === undefined ? y : lambda * y + (1 - lambda) * previous
}

export interface Answer {
  packId: string
  itemId: string
  face: Face
  rating: Rating
  /** 回答した日時（エポックミリ秒） */
  at: number
}

/** 1 回の自己申告を反映した、新しい学習状況を返す */
export function applyAnswer(
  previous: ProgressRecord | undefined,
  { packId, itemId, face, rating, at }: Answer,
): ProgressRecord {
  return {
    packId,
    itemId,
    mastery: nextMastery(previous?.mastery, rating),
    lastReviewedAt: at,
    lastReviewedAtByFace: { ...previous?.lastReviewedAtByFace, [face]: at },
  }
}
