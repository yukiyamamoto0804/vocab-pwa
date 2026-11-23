import { describe, expect, it } from 'vitest'
import { isReturnToUnits, RETURN_TO_UNITS } from './returnToUnits'

describe('isReturnToUnits', () => {
  it('ユニット一覧へ戻る印だけを見分ける', () => {
    expect(isReturnToUnits(RETURN_TO_UNITS)).toBe(true)
    expect(isReturnToUnits({ returnToUnits: true, other: 1 })).toBe(true)
    for (const state of [null, undefined, {}, { returnToUnits: 'yes' }, 'x'])
      expect(isReturnToUnits(state)).toBe(false)
  })
})
