import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readBackupRecords } from './backup'
import { VocabDatabase } from './database'
import type { ProgressRecord, ReportRecord, StudySessionRecord } from './types'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`backup-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

const progress: ProgressRecord = {
  packId: 'pack-a',
  itemId: 'w1',
  mastery: 0.4,
  lastReviewedAt: 10,
  lastReviewedAtByFace: { en: 10 },
}
const session: StudySessionRecord = {
  id: 's1',
  packId: 'pack-a',
  startedAt: 5,
  mode: 'unit',
  face: 'en',
  itemIds: ['w1'],
  seconds: [3],
  ratings: 'u',
}
const report: ReportRecord = { id: 'r1', at: 7, packId: 'pack-a', itemId: 'w1' }

describe('readBackupRecords', () => {
  it('記録がなければ、どれも空', async () => {
    expect(await readBackupRecords(db)).toEqual({
      progress: [],
      studySessions: [],
      reports: [],
      settings: [],
    })
  })

  it('学習記録のテーブルを読み、設定は含めるキーだけにする', async () => {
    await db.progress.add(progress)
    await db.studySessions.add(session)
    await db.reports.add(report)
    await db.settings.bulkAdd([
      { key: 'face', value: 'en' },
      { key: 'lastTest:pack-a', value: { at: 1, fromUnit: 1, toUnit: 2 } },
      { key: 'inProgress:pack-a', value: {} },
      { key: 'lastExport', value: 1 },
    ])
    const records = await readBackupRecords(db)
    expect(records.progress).toEqual([progress])
    expect(records.studySessions).toEqual([session])
    expect(records.reports).toEqual([report])
    expect(records.settings.map((s) => s.key).sort()).toEqual([
      'face',
      'lastTest:pack-a',
    ])
  })
})
