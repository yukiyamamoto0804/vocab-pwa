import {
  type Face,
  RATING_CODES,
  type Rating,
  type StudyMode,
  type StudySessionRecord,
} from '../../db/types'

// 学習 1 回分の回答の記録（docs/ARCHITECTURE.md 4 章「回答の記録」）を作る・追記する

export function createSessionRecord(params: {
  id: string
  packId: string
  mode: StudyMode
  face: Face
  startedAt: number
}): StudySessionRecord {
  return { ...params, itemIds: [], seconds: [], ratings: '' }
}

/** 回答を 1 つ追記した新しい記録を返す */
export function appendAnswer(
  record: StudySessionRecord,
  itemId: string,
  rating: Rating,
  at: number,
): StudySessionRecord {
  return {
    ...record,
    itemIds: [...record.itemIds, itemId],
    seconds: [
      ...record.seconds,
      Math.max(0, Math.round((at - record.startedAt) / 1000)),
    ],
    ratings: record.ratings + RATING_CODES[rating],
  }
}
