import { describe, expect, it } from 'vitest'
import { countAfterTake, takeCount } from './studyCount'

describe('takeCount / countAfterTake', () => {
  const items = ['a', 'b', 'c']

  it('出題数で切る。すべてなら全部', () => {
    expect(takeCount(items, 20)).toEqual(items)
    expect(takeCount(items, 'all')).toEqual(items)
    expect(
      takeCount(
        Array.from({ length: 30 }, (_, i) => i),
        20,
      ),
    ).toHaveLength(20)
  })

  it('語数は切った後の数と一致する', () => {
    expect(countAfterTake(3, 20)).toBe(3)
    expect(countAfterTake(30, 20)).toBe(20)
    expect(countAfterTake(30, 'all')).toBe(30)
    expect(countAfterTake(0, 50)).toBe(0)
  })
})
