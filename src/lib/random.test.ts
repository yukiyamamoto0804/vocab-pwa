import { describe, expect, it } from 'vitest'
import { shuffle } from './random'

describe('shuffle', () => {
  it('同じ要素を並べ替えた新しい配列を返し、元の配列は変えない', () => {
    const items = [1, 2, 3, 4, 5]
    const result = shuffle(items, () => 0)
    expect([...result].sort()).toEqual(items)
    expect(result).not.toBe(items)
    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('乱数に応じて並べ替える', () => {
    // 乱数が常に 0 なら、後ろから順に先頭と入れ替わり、先頭の要素が最後に回る
    expect(shuffle([1, 2, 3, 4, 5], () => 0)).toEqual([2, 3, 4, 5, 1])
  })

  it('0 件・1 件でもそのまま返す', () => {
    expect(shuffle([], () => 0)).toEqual([])
    expect(shuffle([1], () => 0)).toEqual([1])
  })

  it('乱数が同じなら同じ並びになる', () => {
    const seq = [0.1, 0.7, 0.3, 0.9]
    const make = () => {
      let i = 0
      return () => seq[i++ % seq.length]
    }
    expect(shuffle([1, 2, 3, 4, 5], make())).toEqual(
      shuffle([1, 2, 3, 4, 5], make()),
    )
  })
})
