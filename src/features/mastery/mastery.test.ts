import { describe, expect, it } from 'vitest'
import { applyAnswer, nextMastery } from './mastery'

describe('nextMastery', () => {
  it('初回は自己申告の値そのもの', () => {
    expect(nextMastery(undefined, 'remembered')).toBe(1)
    expect(nextMastery(undefined, 'unsure')).toBe(0.5)
    expect(nextMastery(undefined, 'forgot')).toBe(0)
  })

  it('2 回目以降は指数移動平均（λ = 0.4 なら 1 回「忘れた」で 6 割に下がる）', () => {
    expect(nextMastery(1, 'forgot', 0.4)).toBeCloseTo(0.6)
    expect(nextMastery(0, 'remembered', 0.4)).toBeCloseTo(0.4)
    expect(nextMastery(0.5, 'unsure', 0.4)).toBeCloseTo(0.5)
  })
})

describe('applyAnswer', () => {
  const answer = {
    packId: 'p',
    itemId: '0001',
    face: 'en',
    rating: 'remembered',
    at: 2000,
  } as const

  it('初めての回答では、新しい学習状況を作る', () => {
    expect(applyAnswer(undefined, answer)).toEqual({
      packId: 'p',
      itemId: '0001',
      mastery: 1,
      lastReviewedAt: 2000,
      lastReviewedAtByFace: { en: 2000 },
    })
  })

  it('ほかの表面の最終出題日時は残す', () => {
    const previous = {
      packId: 'p',
      itemId: '0001',
      mastery: 0,
      lastReviewedAt: 1000,
      lastReviewedAtByFace: { 'word-audio': 1000 },
    }
    expect(applyAnswer(previous, answer).lastReviewedAtByFace).toEqual({
      'word-audio': 1000,
      en: 2000,
    })
  })
})
