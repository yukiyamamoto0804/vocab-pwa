import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from './database'
import {
  getExampleTextShown,
  getLastFace,
  getLastTest,
  getLastUnitStudy,
  getStoredUnitStudySettings,
  lastTestSetting,
  lastUnitStudySetting,
  saveExampleTextShown,
  saveLastFace,
  saveUnitStudySettings,
} from './settings'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`settings-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

describe('getLastTest / lastTestSetting', () => {
  it('パックごとに保存して読み出す', async () => {
    await db.settings.put(
      lastTestSetting('pack-a', { at: 1, fromUnit: 2, toUnit: 5 }),
    )
    expect(await getLastTest('pack-a', db)).toEqual({
      at: 1,
      fromUnit: 2,
      toUnit: 5,
    })
    expect(await getLastTest('pack-b', db)).toBeUndefined()
  })

  it('形が違う値は無いものとして扱う', async () => {
    await db.settings.put({ key: 'lastTest:pack-a', value: { at: 1 } })
    expect(await getLastTest('pack-a', db)).toBeUndefined()
  })

  it('NaN や Infinity は無いものとして扱う', async () => {
    await db.settings.put({
      key: 'lastTest:pack-a',
      value: { at: Number.NaN, fromUnit: 1, toUnit: Number.POSITIVE_INFINITY },
    })
    expect(await getLastTest('pack-a', db)).toBeUndefined()
  })
})

describe('getLastUnitStudy / lastUnitStudySetting', () => {
  it('パックごとに保存して読み出す', async () => {
    await db.settings.put(lastUnitStudySetting('pack-a', { at: 1, unitId: 3 }))
    expect(await getLastUnitStudy('pack-a', db)).toEqual({ at: 1, unitId: 3 })
    expect(await getLastUnitStudy('pack-b', db)).toBeUndefined()
  })

  it('形が違う値は無いものとして扱う', async () => {
    await db.settings.put({
      key: 'lastUnitStudy:pack-a',
      value: { at: 1, unitId: '3' },
    })
    expect(await getLastUnitStudy('pack-a', db)).toBeUndefined()
  })

  it('余分なキーは取り出さない', async () => {
    await db.settings.put({
      key: 'lastUnitStudy:pack-a',
      value: { at: 1, unitId: 3, extra: 'x' },
    })
    expect(await getLastUnitStudy('pack-a', db)).toEqual({ at: 1, unitId: 3 })
  })
})

describe('getStoredUnitStudySettings / saveUnitStudySettings', () => {
  it('保存した値をそのまま読み出す。保存していなければ undefined', async () => {
    expect(await getStoredUnitStudySettings(db)).toBeUndefined()
    await saveUnitStudySettings({ mixCount: 0, mixSessionRange: 10 }, db)
    expect(await getStoredUnitStudySettings(db)).toEqual({
      mixCount: 0,
      mixSessionRange: 10,
    })
  })
})

describe('getLastFace / saveLastFace', () => {
  it('保存した表面の種類を読み出す。保存していない・不明な値なら undefined', async () => {
    expect(await getLastFace(db)).toBeUndefined()
    await saveLastFace('word-audio', db)
    expect(await getLastFace(db)).toBe('word-audio')
    await db.settings.put({ key: 'face', value: 'xx' })
    expect(await getLastFace(db)).toBeUndefined()
  })
})

describe('getExampleTextShown / saveExampleTextShown', () => {
  it('保存した値を読み出す。保存していない・形の違う値なら false', async () => {
    expect(await getExampleTextShown(db)).toBe(false)
    await saveExampleTextShown(true, db)
    expect(await getExampleTextShown(db)).toBe(true)
    await db.settings.put({ key: 'exampleTextShown', value: 'yes' })
    expect(await getExampleTextShown(db)).toBe(false)
  })
})
