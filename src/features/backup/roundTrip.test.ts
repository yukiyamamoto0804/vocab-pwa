import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readBackupRecords } from '../../db/backup'
import { VocabDatabase } from '../../db/database'
import {
  lastTestSetting,
  lastUnitStudySetting,
  saveExampleTextShown,
  saveFrontSenseChoice,
  saveLastExport,
  saveLastFace,
  saveUnitStudySettings,
} from '../../db/settings'
import { inProgressKey, saveAnswer, toggleReport } from '../../db/study'
import { importRecordsBackup, readRecordsBackupFile } from './importRecords'
import { createRecordsBackupFile } from './recordsFile'

// 書き出したファイルを、別の端末（別の DB）に読み込み直す往復。
// アプリの書き込みの処理で作った記録が、確かめで断られずに同じ形で戻ることを確かめる

let from: VocabDatabase
let to: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  from = new VocabDatabase(`round-trip-from-${dbCount}`)
  to = new VocabDatabase(`round-trip-to-${dbCount}`)
})

afterEach(async () => {
  await from.delete()
  await to.delete()
})

describe('学習記録の書き出しと読み込み', () => {
  it('アプリで作った記録が、そのまま戻る。途中の学習と端末ごとの値は移さない', async () => {
    await saveAnswer(
      {
        session: {
          id: 's1',
          packId: 'pack-a',
          startedAt: 1000,
          mode: 'unit',
          face: 'en',
          itemIds: ['w1', 'w2', 'w1'],
          seconds: [2, 5, 9],
          ratings: 'fur',
        },
        progress: {
          packId: 'pack-a',
          itemId: 'w1',
          mastery: 0.64,
          lastReviewedAt: 1009,
          lastReviewedAtByFace: { en: 1009, ja: 500 },
        },
        inProgress: {
          key: 'unit:1',
          sessionId: 's1',
          order: ['w1', 'w2'],
          frontSenses: {},
          priors: [null, null, null],
          before: [],
        },
        firstAnswerSettings: [
          lastUnitStudySetting('pack-a', { at: 1000, unitId: 1 }),
        ],
      },
      from,
    )
    await from.settings.put(
      lastTestSetting('pack-b', { at: 900, fromUnit: 1, toUnit: 3 }),
    )
    await toggleReport('pack-a', 'w2', 1005, from)
    await saveUnitStudySettings({ mixCount: 0, mixSessionRange: 10 }, from)
    await saveLastFace('word-audio', from)
    await saveExampleTextShown(true, from)
    await saveFrontSenseChoice('first', from)
    await saveLastExport(800, from)

    // 書き出す側には途中の学習がある
    expect(await from.settings.get(inProgressKey('pack-a'))).toBeDefined()

    const file = await createRecordsBackupFile(2000, from)
    const result = await readRecordsBackupFile(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    await importRecordsBackup(result.backup, to)

    expect(await readBackupRecords(to)).toEqual(await readBackupRecords(from))
    expect(await to.settings.get(inProgressKey('pack-a'))).toBeUndefined()
    expect(await to.settings.get('lastExport')).toBeUndefined()
  })
})
