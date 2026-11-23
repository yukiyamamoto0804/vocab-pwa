import { describe, expect, it } from 'vitest'
import { rememberUnitRow, takeUnitRow } from './unitRowPosition'

describe('rememberUnitRow / takeUnitRow', () => {
  it('覚えた位置を 1 回だけ取り出せる', () => {
    rememberUnitRow({ packId: 'p', unitId: 3, top: 120 })
    expect(takeUnitRow('p')).toEqual({ packId: 'p', unitId: 3, top: 120 })
    expect(takeUnitRow('p')).toBeUndefined()
  })

  it('続けて覚えたら、後のほうを使う（別のユニットの「学習」を押し直したとき）', () => {
    rememberUnitRow({ packId: 'p', unitId: 3, top: 120 })
    rememberUnitRow({ packId: 'p', unitId: 5, top: 300 })
    expect(takeUnitRow('p')).toEqual({ packId: 'p', unitId: 5, top: 300 })
  })

  it('別のパックでは使わず、そのまま忘れる', () => {
    rememberUnitRow({ packId: 'p', unitId: 3, top: 120 })
    expect(takeUnitRow('q')).toBeUndefined()
    expect(takeUnitRow('p')).toBeUndefined()
  })
})
