import { describe, expect, it } from 'vitest'
import {
  answersOf,
  appendAnswer,
  countRatings,
  createSessionRecord,
  ratingAt,
  removeLastAnswer,
} from './sessionRecord'

describe('sessionRecord', () => {
  it('回答を順に追記し、学習開始からの秒数を整数で記録する', () => {
    let record = createSessionRecord({
      id: 's1',
      packId: 'p',
      mode: 'unit',
      face: 'en',
      startedAt: 10_000,
    })
    record = appendAnswer(record, '0001', 'remembered', 10_400)
    record = appendAnswer(record, '0002', 'forgot', 16_600)
    record = appendAnswer(record, '0001', 'unsure', 20_000)
    expect(record).toMatchObject({
      itemIds: ['0001', '0002', '0001'],
      seconds: [0, 7, 10],
      ratings: 'rfu',
    })
  })

  it('元の記録は変えない', () => {
    const record = createSessionRecord({
      id: 's1',
      packId: 'p',
      mode: 'unit',
      face: 'en',
      startedAt: 0,
    })
    appendAnswer(record, '0001', 'remembered', 1000)
    expect(record.itemIds).toEqual([])
  })

  it('最後の回答を取り除き、申告を数え、単語と申告の組にする', () => {
    let record = createSessionRecord({
      id: 's1',
      packId: 'p',
      mode: 'unit',
      face: 'en',
      startedAt: 0,
    })
    record = appendAnswer(record, '0001', 'forgot', 0)
    record = appendAnswer(record, '0002', 'remembered', 1000)
    record = appendAnswer(record, '0001', 'unsure', 2000)
    expect(countRatings(record)).toEqual({
      remembered: 1,
      unsure: 1,
      forgot: 1,
    })
    const removed = removeLastAnswer(record)
    expect(removed).toMatchObject({
      itemIds: ['0001', '0002'],
      seconds: [0, 1],
      ratings: 'fr',
    })
    expect(answersOf(removed)).toEqual([
      { itemId: '0001', rating: 'forgot' },
      { itemId: '0002', rating: 'remembered' },
    ])
    expect(ratingAt({ ratings: 'x' }, 0)).toBeUndefined()
  })
})
