import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from './database'
import {
  listReportedItemIds,
  restoreBeforeAnswer,
  saveAnswer,
  toggleReport,
} from './study'
import type { ProgressRecord, StudySessionRecord } from './types'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`study-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

const emptySession: StudySessionRecord = {
  id: 's1',
  packId: 'p',
  startedAt: 0,
  mode: 'unit',
  face: 'en',
  itemIds: [],
  seconds: [],
  ratings: '',
}
const progress = (mastery: number): ProgressRecord => ({
  packId: 'p',
  itemId: '0001',
  mastery,
  lastReviewedAt: 0,
  lastReviewedAtByFace: { en: 0 },
})
const key = { packId: 'p', itemId: '0001' }

describe('saveAnswer / restoreBeforeAnswer', () => {
  it('初めての回答を取り消すと、記録も学習状況も残らない', async () => {
    const answered = {
      ...emptySession,
      itemIds: ['0001'],
      seconds: [0],
      ratings: 'r',
    }
    await saveAnswer(answered, progress(1), db)
    expect(await db.studySessions.count()).toBe(1)

    await restoreBeforeAnswer(emptySession, key, undefined, db)
    expect(await db.studySessions.count()).toBe(0)
    expect(await db.progress.count()).toBe(0)
  })

  it('2 回目以降の回答を取り消すと、1 つ前の記録と学習状況に戻る', async () => {
    const first = {
      ...emptySession,
      itemIds: ['0001'],
      seconds: [0],
      ratings: 'f',
    }
    await saveAnswer(first, progress(0), db)
    const second = {
      ...first,
      itemIds: ['0001', '0001'],
      seconds: [0, 5],
      ratings: 'fr',
    }
    await saveAnswer(second, progress(0.4), db)

    await restoreBeforeAnswer(first, key, progress(0), db)
    expect((await db.studySessions.get('s1'))?.ratings).toBe('f')
    expect((await db.progress.get(['p', '0001']))?.mastery).toBe(0)
  })
})

describe('toggleReport', () => {
  it('押すたびに報告と取り消しを切り替え、パックごとに報告済みの単語を返す', async () => {
    expect(await toggleReport('p', '0001', 0, db)).toBe(true)
    await toggleReport('q', '0002', 0, db)
    expect([...(await listReportedItemIds('p', db))]).toEqual(['0001'])

    expect(await toggleReport('p', '0001', 1, db)).toBe(false)
    expect((await listReportedItemIds('p', db)).size).toBe(0)
  })
})
