import { describe, expect, it } from 'vitest'
import { createDummyPack } from './dummyPack'
import { assignUnits } from './units'

describe('assignUnits', () => {
  it('ユニットの指定がなければ、並び順で区切り、最後は端数になる', () => {
    const { manifest, items } = createDummyPack({ itemCount: 45 })
    const { units, unitOfItems } = assignUnits(manifest, items, 20)
    expect(units).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(unitOfItems.filter((u) => u === 2)).toHaveLength(20)
    expect(unitOfItems.filter((u) => u === 3)).toHaveLength(5)
    expect(unitOfItems[19]).toBe(1)
    expect(unitOfItems[20]).toBe(2)
  })

  it('語数がちょうど割り切れるときは端数のユニットを作らない', () => {
    const { manifest, items } = createDummyPack({ itemCount: 40 })
    expect(assignUnits(manifest, items, 20).units).toHaveLength(2)
  })

  it('教材でユニットが指定されていれば、それに従う', () => {
    const { manifest, items } = createDummyPack({ itemCount: 5, unitSize: 3 })
    manifest.units?.reverse()
    const { units, unitOfItems } = assignUnits(manifest, items, 20)
    expect(units.map((u) => u.id)).toEqual([1, 2])
    expect(units[0].title).toBe('ユニット1')
    expect(unitOfItems).toEqual([1, 1, 1, 2, 2])
  })

  it('単語が 1 つもないユニットは作らない', () => {
    const { manifest, items } = createDummyPack({ itemCount: 3, unitSize: 3 })
    manifest.units?.push({ id: 5, title: '空のユニット' })
    expect(assignUnits(manifest, items, 20).units.map((u) => u.id)).toEqual([1])
  })
})
