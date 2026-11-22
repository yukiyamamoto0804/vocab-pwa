import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import { saveUnitStudySettings } from '../../db/settings'
import type { StudySessionRecord } from '../../db/types'
import { forgottenItemIds, loadMixItems, selectMixItems } from './mixItems'

describe('forgottenItemIds', () => {
  it('一度でも「忘れた」と申告した単語を、重複なく返す', () => {
    const sessions = [
      // a は「忘れた」の後に出し直して「覚えた」。最後の申告は「忘れた」ではないが対象にする
      { itemIds: ['a', 'b', 'a'], ratings: 'frr' },
      { itemIds: ['c', 'a', 'd'], ratings: 'fuf' },
    ]
    expect(forgottenItemIds(sessions, new Set()).sort()).toEqual([
      'a',
      'c',
      'd',
    ])
  })

  it('除く単語（学習するユニットの単語）は返さない', () => {
    const sessions = [{ itemIds: ['a', 'b'], ratings: 'ff' }]
    expect(forgottenItemIds(sessions, new Set(['a']))).toEqual(['b'])
  })

  it('「忘れた」がなければ空', () => {
    expect(
      forgottenItemIds([{ itemIds: ['a'], ratings: 'u' }], new Set()),
    ).toEqual([])
  })
})

describe('selectMixItems', () => {
  const candidates = ['a', 'b', 'c', 'd', 'e']

  it('候補が多ければ、count 個を重複なく選ぶ', () => {
    const result = selectMixItems(candidates, 3)
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
    expect(result.every((id) => candidates.includes(id))).toBe(true)
  })

  it('選ぶ単語は乱数によって変わる', () => {
    expect(selectMixItems(candidates, 2, () => 0)).not.toEqual(
      selectMixItems(candidates, 2, () => 0.99),
    )
  })

  it('候補が少なければ、ある分だけ。count が 0 なら選ばない', () => {
    expect(selectMixItems(['a', 'b'], 5).sort()).toEqual(['a', 'b'])
    expect(selectMixItems(candidates, 0)).toEqual([])
  })
})

describe('loadMixItems', () => {
  let db: VocabDatabase
  let dbCount = 0

  const session = (
    id: string,
    startedAt: number,
    itemIds: string[],
    ratings: string,
  ): StudySessionRecord => ({
    id,
    packId: 'p',
    startedAt,
    mode: 'unit',
    face: 'en',
    itemIds,
    seconds: itemIds.map(() => 0),
    ratings,
  })

  beforeEach(async () => {
    dbCount += 1
    db = new VocabDatabase(`mix-items-test-${dbCount}`)
    // 単語 old・a・b・u がある（gone は取り込み直して消えた単語）
    await db.items.bulkPut(
      ['old', 'a', 'b', 'u'].map((id, order) => ({
        packId: 'p',
        id,
        unit: 1,
        order,
        word: id,
        senses: [],
      })),
    )
    await db.studySessions.bulkPut([
      session('s1', 1, ['old'], 'f'),
      session('s2', 2, ['a', 'gone'], 'ff'),
      session('s3', 3, ['b', 'u'], 'ff'),
    ])
  })

  afterEach(async () => {
    await db.delete()
  })

  const load = async (unitItemIds: string[] = []) =>
    (await loadMixItems('p', new Set(unitItemIds), { db })).map((i) => i.id)

  it('直前 N 回の「忘れた」だけを対象にし、消えた単語と学習するユニットの単語は除く', async () => {
    await saveUnitStudySettings({ mixCount: 20, mixSessionRange: 2 }, db)
    expect((await load(['u'])).sort()).toEqual(['a', 'b'])
  })

  it('保存していなければ初期値（直前 3 回）を使う', async () => {
    expect((await load()).sort()).toEqual(['a', 'b', 'old', 'u'])
  })

  it('混ぜる数が 0 なら空', async () => {
    await saveUnitStudySettings({ mixCount: 0, mixSessionRange: 3 }, db)
    expect(await load()).toEqual([])
  })
})
