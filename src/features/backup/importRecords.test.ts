import { describe, expect, it } from 'vitest'
import { readRecordsBackupFile, summarizeBackup } from './importRecords'
import { MAX_BACKUP_FILE_BYTES } from './parseBackup'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type RecordsBackup,
} from './recordsFile'

const empty: RecordsBackup = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: 1,
  progress: [],
  studySessions: [],
  reports: [],
  settings: [],
}

describe('readRecordsBackupFile', () => {
  it('ファイルを読んで確かめる', async () => {
    const file = new File([JSON.stringify(empty)], 'a.json')
    expect(await readRecordsBackupFile(file)).toEqual({
      ok: true,
      backup: empty,
    })
  })

  it('教材の zip は、大きくても取り込みの画面を案内する', async () => {
    const file = new File(['PK\u0003\u0004'], 'pack.zip')
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_FILE_BYTES + 1 })
    expect(await readRecordsBackupFile(file)).toEqual({
      ok: false,
      errors: [expect.stringContaining('「取り込み」の画面')],
    })
  })

  it('大きすぎるファイルは、読む前に断る', async () => {
    const file = new File(['x'], 'a.json')
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_FILE_BYTES + 1 })
    expect(await readRecordsBackupFile(file)).toEqual({
      ok: false,
      errors: [expect.stringContaining('大きすぎます')],
    })
  })
})

describe('summarizeBackup', () => {
  it('取り込み済みのパックをその順に、取り込んでいないパックを id の順に後ろに並べる', () => {
    const session = (id: string, packId: string) => ({
      id,
      packId,
      startedAt: 1,
      mode: 'unit' as const,
      face: 'en' as const,
      itemIds: [],
      seconds: [],
      ratings: '',
    })
    const progress = (packId: string, itemId: string) => ({
      packId,
      itemId,
      mastery: 0,
      lastReviewedAt: 1,
      lastReviewedAtByFace: {},
    })
    const backup: RecordsBackup = {
      ...empty,
      studySessions: [
        session('s1', 'z'),
        session('s2', 'b'),
        session('s3', 'b'),
      ],
      progress: [progress('b', 'w1'), progress('y', 'w1')],
      reports: [{ id: 'r1', at: 1, packId: 'a', itemId: 'w1' }],
    }
    const packs = [
      { id: 'b', title: 'B のパック' },
      { id: 'a', title: 'A のパック' },
      { id: 'c', title: '記録のないパック' },
    ]
    expect(summarizeBackup(backup, packs)).toEqual([
      {
        packId: 'b',
        title: 'B のパック',
        studySessions: 2,
        progress: 1,
        reports: 0,
      },
      {
        packId: 'a',
        title: 'A のパック',
        studySessions: 0,
        progress: 0,
        reports: 1,
      },
      {
        packId: 'y',
        title: undefined,
        studySessions: 0,
        progress: 1,
        reports: 0,
      },
      {
        packId: 'z',
        title: undefined,
        studySessions: 1,
        progress: 0,
        reports: 0,
      },
    ])
  })
})
