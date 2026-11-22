import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createRecordsBackupFile,
  recordsBackupFileName,
} from './recordsFile'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`records-file-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

describe('recordsBackupFileName', () => {
  it('端末の時刻の年月日と時分を、0 で埋めて入れる', () => {
    const at = new Date(2026, 0, 2, 3, 4, 59).getTime()
    expect(recordsBackupFileName(at)).toBe('vocab-backup-20260102-0304.json')
  })
})

describe('createRecordsBackupFile', () => {
  it('形式の印・版・日時と、学習記録を JSON で書く', async () => {
    const now = new Date(2026, 10, 23, 14, 5).getTime()
    await db.reports.add({ id: 'r1', at: 1, packId: 'p', itemId: 'w1' })
    await db.settings.put({ key: 'inProgress:p', value: {} })
    const file = await createRecordsBackupFile(now, db)
    expect(file.name).toBe('vocab-backup-20261123-1405.json')
    expect(file.type).toBe('application/json')
    expect(JSON.parse(await file.text())).toEqual({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now,
      progress: [],
      studySessions: [],
      reports: [{ id: 'r1', at: 1, packId: 'p', itemId: 'w1' }],
      settings: [],
    })
  })
})
