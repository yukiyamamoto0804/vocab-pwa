import { describe, expect, it } from 'vitest'
import { appendAnswer, createSessionRecord } from './sessionRecord'

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
})
