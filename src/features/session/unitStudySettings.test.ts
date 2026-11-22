import { describe, expect, it } from 'vitest'
import { normalizeUnitStudySettings } from './unitStudySettings'

describe('normalizeUnitStudySettings', () => {
  it('保存していなければ初期値', () => {
    expect(normalizeUnitStudySettings(undefined)).toEqual({
      mixCount: 5,
      mixSessionRange: 3,
    })
  })

  it('範囲内の値はそのまま使う（範囲の端も受け付ける）', () => {
    expect(
      normalizeUnitStudySettings({ mixCount: 0, mixSessionRange: 10 }),
    ).toEqual({ mixCount: 0, mixSessionRange: 10 })
    expect(
      normalizeUnitStudySettings({ mixCount: 20, mixSessionRange: 1 }),
    ).toEqual({ mixCount: 20, mixSessionRange: 1 })
  })

  it('範囲外や形の違う項目は、その項目だけ初期値にする', () => {
    expect(
      normalizeUnitStudySettings({ mixCount: 21, mixSessionRange: 2 }),
    ).toEqual({ mixCount: 5, mixSessionRange: 2 })
    expect(
      normalizeUnitStudySettings({ mixCount: 1.5, mixSessionRange: '4' }),
    ).toEqual({ mixCount: 5, mixSessionRange: 3 })
    expect(normalizeUnitStudySettings('x')).toEqual({
      mixCount: 5,
      mixSessionRange: 3,
    })
  })
})
