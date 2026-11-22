import type { studyConfig } from '../studyConfig'

/** テスト・復習の出題数。'all' は対象の単語すべて */
export type StudyCount = (typeof studyConfig.studyCount.options)[number]

// テスト・復習の出題数で切る。シートに出す語数と、実際に出す語数を必ず揃えるため 1 か所にまとめる

/** 先頭から出題数だけ残す */
export function takeCount<T>(items: readonly T[], count: StudyCount): T[] {
  return count === 'all' ? [...items] : items.slice(0, count)
}

/** 対象が total 語のとき、出題数で切った後の語数 */
export function countAfterTake(total: number, count: StudyCount): number {
  return count === 'all' ? total : Math.min(count, total)
}
