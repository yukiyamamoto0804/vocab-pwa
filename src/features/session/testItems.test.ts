import { describe, expect, it } from 'vitest'
import { countTestItems, defaultTestRange, selectTestItems } from './testItems'

const ids = ['a', 'b', 'c', 'd', 'e']
const items = ids.map((id) => ({ id }))
/** a, c, e は学習済み。b, d は未学習 */
const progress = new Map([
  ['a', { mastery: 0.9 }],
  ['c', { mastery: 0.2 }],
  ['e', { mastery: 0.5 }],
])
const idsOf = (list: { id: string }[]) => list.map((i) => i.id)

describe('selectTestItems', () => {
  it('苦手優先では定着度の低い順に並べる', () => {
    const result = selectTestItems(items, progress, {
      count: 'all',
      includeUnlearned: false,
      order: 'weak',
    })
    expect(idsOf(result)).toEqual(['c', 'e', 'a'])
  })

  it('未学習の語を含めると、苦手優先では定着度 0 として先頭に来る', () => {
    const result = idsOf(
      selectTestItems(items, progress, {
        count: 'all',
        includeUnlearned: true,
        order: 'weak',
      }),
    )
    expect(result.slice(0, 2).sort()).toEqual(['b', 'd'])
    expect(result.slice(2)).toEqual(['c', 'e', 'a'])
  })

  it('苦手優先で定着度が同じ単語どうしは、乱数によって順番が変わる', () => {
    const same = new Map(ids.map((id) => [id, { mastery: 0.5 }]))
    const options = {
      count: 'all',
      includeUnlearned: false,
      order: 'weak',
    } as const
    const first = idsOf(selectTestItems(items, same, options, () => 0))
    const second = idsOf(selectTestItems(items, same, options, () => 0.99))
    expect([...first].sort()).toEqual(ids)
    expect(first).not.toEqual(second)
  })

  it('苦手優先で出題数より多いときは、苦手なものから出題数だけ残す', () => {
    // 前の 20 語は苦手（0.05）、後ろの 10 語は得意（0.95）
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}` }))
    const manyProgress = new Map(
      many.map(({ id }, i) => [id, { mastery: i < 20 ? 0.05 : 0.95 }]),
    )
    const result = selectTestItems(many, manyProgress, {
      count: 20,
      includeUnlearned: false,
      order: 'weak',
    })
    expect(idsOf(result).sort()).toEqual(idsOf(many.slice(0, 20)).sort())
  })

  it('苦手優先では、定着度を帯に分けて比べる。同じ帯の中は乱数で順番が変わる', () => {
    const banded = [
      { id: 'top', mastery: 1 }, // 1 は 0.9〜1 の帯
      { id: 'high', mastery: 0.95 },
      { id: 'exact', mastery: 0.3 }, // ちょうど 0.3 は 0.3〜0.4 の帯（誤差で下にずれない）
      { id: 'low1', mastery: 0.21 },
      { id: 'low2', mastery: 0.29 },
    ]
    const bandedItems = banded.map(({ id }) => ({ id }))
    const bandedProgress = new Map(
      banded.map(({ id, mastery }) => [id, { mastery }]),
    )
    const options = {
      count: 'all',
      includeUnlearned: false,
      order: 'weak',
    } as const
    const results = [0, 0.5, 0.99].map((r) =>
      idsOf(selectTestItems(bandedItems, bandedProgress, options, () => r)),
    )
    for (const result of results) {
      expect(result.slice(0, 2).sort()).toEqual(['low1', 'low2'])
      expect(result[2]).toBe('exact')
      expect(result.slice(3).sort()).toEqual(['high', 'top'])
    }
    expect(new Set(results.map((r) => r.join())).size).toBeGreaterThan(1)
  })

  it('ランダムで出題数より多いときは、対象から重複なく出題数だけ選ぶ', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}` }))
    const result = idsOf(
      selectTestItems(many, new Map(), {
        count: 20,
        includeUnlearned: true,
        order: 'random',
      }),
    )
    expect(result).toHaveLength(20)
    expect(new Set(result).size).toBe(20)
    expect(result.every((id) => idsOf(many).includes(id))).toBe(true)
  })

  it('ランダムでも、未学習の語を含めないときは学習済みの語だけ出す', () => {
    const result = idsOf(
      selectTestItems(items, progress, {
        count: 'all',
        includeUnlearned: false,
        order: 'random',
      }),
    )
    expect(result.sort()).toEqual(['a', 'c', 'e'])
  })

  it('対象がなければ空', () => {
    expect(
      selectTestItems(items, new Map(), {
        count: 50,
        includeUnlearned: false,
        order: 'weak',
      }),
    ).toEqual([])
  })
})

describe('countTestItems', () => {
  it('未学習の語を含めるかで対象が変わり、出題数を超えない', () => {
    expect(countTestItems(30, 80, { count: 50, includeUnlearned: false })).toBe(
      30,
    )
    expect(countTestItems(30, 80, { count: 50, includeUnlearned: true })).toBe(
      50,
    )
    expect(
      countTestItems(30, 80, { count: 'all', includeUnlearned: true }),
    ).toBe(80)
    expect(countTestItems(0, 80, { count: 20, includeUnlearned: false })).toBe(
      0,
    )
  })
})

describe('defaultTestRange', () => {
  const units = [
    { id: 1, learnedCount: 20 },
    { id: 2, learnedCount: 0 },
    { id: 3, learnedCount: 5 },
    { id: 4, learnedCount: 0 },
  ]

  it('前回の範囲があればそれを使う', () => {
    expect(defaultTestRange(units, { fromUnit: 2, toUnit: 4 })).toEqual({
      fromUnit: 2,
      toUnit: 4,
    })
  })

  it('前回がなければ、最初から学習済みの単語がある最後のユニットまで', () => {
    expect(defaultTestRange(units)).toEqual({ fromUnit: 1, toUnit: 3 })
  })

  it('前回のユニットが今はない（取り込み直して減った）ときは、前回がないものとして扱う', () => {
    expect(defaultTestRange(units, { fromUnit: 2, toUnit: 9 })).toEqual({
      fromUnit: 1,
      toUnit: 3,
    })
  })

  it('学習済みの単語がなければ最初のユニットだけ。ユニットがなければ undefined', () => {
    expect(
      defaultTestRange(units.map((u) => ({ ...u, learnedCount: 0 }))),
    ).toEqual({ fromUnit: 1, toUnit: 1 })
    expect(defaultTestRange([])).toBeUndefined()
  })
})
