import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  countBackupRecords,
  readBackupRecords,
  replaceBackupRecords,
} from './backup'
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

describe('countBackupRecords', () => {
  it('学習の回数・学習済みの語数・報告の数を数える', async () => {
    await db.progress.add(progress)
    await db.studySessions.add(session)
    expect(await countBackupRecords(db)).toEqual({
      studySessions: 1,
      progress: 1,
      reports: 0,
    })
  })
})

describe('replaceBackupRecords', () => {
  const next = {
    progress: [{ ...progress, itemId: 'w2', mastery: 0.9 }],
    studySessions: [{ ...session, id: 's2' }],
    reports: [{ ...report, id: 'r2', itemId: 'w2' }],
    settings: [{ key: 'face', value: 'ja' }],
  }

  beforeEach(async () => {
    await db.progress.add(progress)
    await db.studySessions.add(session)
    await db.reports.add(report)
    await db.settings.bulkAdd([
      { key: 'face', value: 'en' },
      { key: 'lastTest:pack-a', value: { at: 1, fromUnit: 1, toUnit: 2 } },
      { key: 'inProgress:pack-a', value: {} },
      { key: 'lastExport', value: 1 },
      { key: 'exportChoice', value: {} },
    ])
    await db.packs.add({
      id: 'pack-a',
      manifest: { formatVersion: 1, id: 'pack-a', title: 'A' },
      importedAt: 1,
    })
  })

  it('学習記録を置き換え、途中の学習を消し、端末ごとの値と教材は残す', async () => {
    await replaceBackupRecords(next, db)
    expect(await db.progress.toArray()).toEqual(next.progress)
    expect(await db.studySessions.toArray()).toEqual(next.studySessions)
    expect(await db.reports.toArray()).toEqual(next.reports)
    expect(
      (await db.settings.toArray()).map((s) => [s.key, s.value]).sort(),
    ).toEqual(
      [
        ['face', 'ja'],
        ['lastExport', 1],
        ['exportChoice', {}],
      ].sort(),
    )
    expect(await db.packs.count()).toBe(1)
  })

  it('途中で失敗したら、何も変えない', async () => {
    const broken = {
      ...next,
      // 主キーが重複していて書けない
      studySessions: [next.studySessions[0], next.studySessions[0]],
    }
    await expect(replaceBackupRecords(broken, db)).rejects.toThrow()
    expect(await db.progress.toArray()).toEqual([progress])
    expect(await db.studySessions.toArray()).toEqual([session])
    expect(await db.reports.toArray()).toEqual([report])
    expect(await db.settings.count()).toBe(5)
  })
})
