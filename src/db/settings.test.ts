import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from './database'
import { getLastTest, saveLastTest } from './settings'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`settings-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

describe('getLastTest / saveLastTest', () => {
  it('パックごとに保存して読み出す', async () => {
    await saveLastTest('pack-a', { at: 1, fromUnit: 2, toUnit: 5 }, db)
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
})
