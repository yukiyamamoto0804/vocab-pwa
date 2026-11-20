import { describe, expect, it } from 'vitest'
import { ratingForDrag } from './dragZone'

describe('ratingForDrag', () => {
  it('距離が足りなければ申告しない', () => {
    expect(ratingForDrag(60, -60)).toBeNull()
  })

  it('55°〜140° の左寄りは「忘れた」、右寄りは「覚えた」', () => {
    expect(ratingForDrag(-120, 0)).toBe('forgot') // 90°
    expect(ratingForDrag(-120, -60)).toBe('forgot') // 約 63°
    expect(ratingForDrag(-100, 80)).toBe('forgot') // 約 129°
    expect(ratingForDrag(120, 0)).toBe('remembered')
    expect(ratingForDrag(120, -60)).toBe('remembered')
  })

  it('0°〜35° は「曖昧」', () => {
    expect(ratingForDrag(0, -120)).toBe('unsure')
    expect(ratingForDrag(60, -120)).toBe('unsure') // 約 27°
    expect(ratingForDrag(-60, -120)).toBe('unsure')
  })

  it('「曖昧」と左右の間（35°〜55°）は申告しない', () => {
    expect(ratingForDrag(100, -100)).toBeNull() // 45°
    expect(ratingForDrag(-100, -100)).toBeNull()
  })

  it('140° より下向きは申告しない', () => {
    expect(ratingForDrag(0, 150)).toBeNull()
    expect(ratingForDrag(100, 150)).toBeNull() // 約 146°
  })

  it('境界ちょうどの値（距離 100、35°・55°・140°）は、内側の範囲に含める', () => {
    // 角度（真上が 0°）の向きに、距離 120 動かす
    const at = (deg: number) => {
      const rad = (deg * Math.PI) / 180
      return ratingForDrag(120 * Math.sin(rad), -120 * Math.cos(rad))
    }
    expect(ratingForDrag(0, -100)).toBe('unsure')
    expect(at(35)).toBe('unsure')
    expect(at(55)).toBe('remembered')
    expect(at(140)).toBe('remembered')
    expect(at(-55)).toBe('forgot')
  })
})
