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

/** 最後の回答を取り除いた新しい記録を返す（「1 つ戻す」） */
export function removeLastAnswer(
  record: StudySessionRecord,
): StudySessionRecord {
  return {
    ...record,
    itemIds: record.itemIds.slice(0, -1),
    seconds: record.seconds.slice(0, -1),
    ratings: record.ratings.slice(0, -1),
  }
}

/** 記録の i 番目の回答の自己申告。不明な文字なら undefined */
export function ratingAt(
  record: Pick<StudySessionRecord, 'ratings'>,
  i: number,
): Rating | undefined {
  const code = record.ratings[i]
  return (Object.keys(RATING_CODES) as Rating[]).find(
    (rating) => RATING_CODES[rating] === code,
  )
}

/** 記録の回答を、自己申告ごとに数える */
export function countRatings(
  record: Pick<StudySessionRecord, 'ratings'>,
): Record<Rating, number> {
  const counts = { remembered: 0, unsure: 0, forgot: 0 }
  for (let i = 0; i < record.ratings.length; i++) {
    const rating = ratingAt(record, i)
    if (rating) counts[rating] += 1
  }
  return counts
}

/** 記録の回答を、単語と自己申告の組にして並べる */
export function answersOf(
  record: Pick<StudySessionRecord, 'itemIds' | 'ratings'>,
): { itemId: string; rating: Rating | undefined }[] {
  return record.itemIds.map((itemId, i) => ({
    itemId,
    rating: ratingAt(record, i),
  }))
}
