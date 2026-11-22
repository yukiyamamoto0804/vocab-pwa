import type { TestOrder } from '../../db/types'
import { type Random, shuffle } from '../../lib/random'
import { studyConfig } from '../studyConfig'
import type { TestCount } from './studyQuery'

// テストで出す単語を選んで並べる（docs/specs/study-cards.md 6 章「テストの範囲と出題数」「テストの並び順」）

export interface TestOptions {
  count: TestCount
  includeUnlearned: boolean
  order: TestOrder
}

/**
 * 範囲の単語から、出す単語を出す順に返す。
 * progress は学習済みの単語の学習状況（記録がない単語は未学習）。
 */
export function selectTestItems<T extends { id: string }>(
  items: readonly T[],
  progress: ReadonlyMap<string, { mastery: number }>,
  { count, includeUnlearned, order }: TestOptions,
  random?: Random,
  bandWidth: number = studyConfig.testWeakBand,
): T[] {
  const targets = includeUnlearned
    ? items
    : items.filter((item) => progress.has(item.id))
  // 苦手優先では、定着度を帯に分けて低い帯から並べる。未学習の単語は定着度 0（一番苦手）として扱う。
  // 定着度 1 は一番上の帯に入れる。割り算の誤差（0.3 / 0.1 = 2.999…）で下の帯にずれないよう、少し足してから切り捨てる
  const topBand = Math.ceil(1 / bandWidth) - 1
  const band = (item: T) =>
    Math.min(
      Math.floor((progress.get(item.id)?.mastery ?? 0) / bandWidth + 1e-9),
      topBand,
    )
  // 先に混ぜておくと、同じ帯の単語どうしの順番がランダムになる（sort は安定）
  const shuffled = shuffle(targets, random)
  const ordered =
    order === 'weak' ? shuffled.sort((a, b) => band(a) - band(b)) : shuffled
  return count === 'all' ? ordered : ordered.slice(0, count)
}

/** 選んだ条件で出す単語の数（開始する前に画面に出す） */
export function countTestItems(
  learnedCount: number,
  itemCount: number,
  { count, includeUnlearned }: Omit<TestOptions, 'order'>,
): number {
  const targets = includeUnlearned ? itemCount : learnedCount
  return count === 'all' ? targets : Math.min(count, targets)
}

/**
 * テストの範囲として最初に選んでおくもの。前回の範囲があり、そのユニットが今もあればそれを使う。
 * なければ、最初のユニットから、学習済みの単語がある最後のユニットまで（学習済みがなければ最初のユニットだけ）。
 * units は番号順。空なら undefined
 */
export function defaultTestRange(
  units: readonly { id: number; learnedCount: number }[],
  last?: { fromUnit: number; toUnit: number },
): { fromUnit: number; toUnit: number } | undefined {
  const first = units[0]
  if (!first) return undefined
  const ids = new Set(units.map((u) => u.id))
  if (
    last &&
    ids.has(last.fromUnit) &&
    ids.has(last.toUnit) &&
    last.fromUnit <= last.toUnit
  )
    return { fromUnit: last.fromUnit, toUnit: last.toUnit }
  const lastLearned = units.findLast((u) => u.learnedCount > 0)
  return { fromUnit: first.id, toUnit: (lastLearned ?? first).id }
}
