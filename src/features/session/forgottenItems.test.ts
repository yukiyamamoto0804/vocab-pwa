import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import { saveUnitStudySettings } from '../../db/settings'
import type { StudySessionRecord } from '../../db/types'
import {
  forgottenItemIds,
  loadMixItems,
  loadReviewItems,
  selectMixItems,
  selectReviewItems,
} from './forgottenItems'

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

  it('後の回で「忘れた」と申告せず「覚えた」と答えた単語は、克服したものとして返さない', () => {
    const sessions = [
      // 新しい順。a は最新の回で「覚えた」、b は最新の回でも「忘れた」
      { itemIds: ['a', 'b', 'b'], ratings: 'rfr' },
      { itemIds: ['a', 'b', 'c'], ratings: 'fff' },
    ]
    expect(forgottenItemIds(sessions).sort()).toEqual(['b', 'c'])
  })

  it('後の回で「曖昧」と答えただけなら、まだ克服していないとして返す', () => {
    const sessions = [
      // 新しい順。a は最新の回で「曖昧」、その前の回で「忘れた」。b は「曖昧」だけで忘れたことはない
      { itemIds: ['a', 'b'], ratings: 'uu' },
      { itemIds: ['a', 'b'], ratings: 'fr' },
    ]
    expect(forgottenItemIds(sessions)).toEqual(['a'])
  })

  it('同じ回に「曖昧」と「覚えた」が両方ある単語は、克服したものとして返さない', () => {
    const sessions = [
      { itemIds: ['a', 'a'], ratings: 'ur' },
      { itemIds: ['a'], ratings: 'f' },
    ]
    expect(forgottenItemIds(sessions)).toEqual([])
  })

  it('除く単語は、複数の回で「忘れた」と申告していても返さない', () => {
    const sessions = [
      { itemIds: ['a'], ratings: 'f' },
      { itemIds: ['a'], ratings: 'f' },
    ]
    expect(forgottenItemIds(sessions, new Set(['a']))).toEqual([])
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

describe('selectReviewItems', () => {
  const items = Array.from({ length: 30 }, (_, i) => `w${i}`)

  it('出題数だけ重複なく選ぶ。すべてなら全部をランダムな順で', () => {
    const picked = selectReviewItems(items, 20)
    expect(picked).toHaveLength(20)
    expect(new Set(picked).size).toBe(20)
    expect(selectReviewItems(items, 'all').sort()).toEqual([...items].sort())
  })

  it('対象が出題数より少なければ全部。空なら空', () => {
    expect(selectReviewItems(['a', 'b'], 50).sort()).toEqual(['a', 'b'])
    expect(selectReviewItems([], 'all')).toEqual([])
  })
})

describe('loadMixItems / loadReviewItems', () => {
  let db: VocabDatabase
  let dbCount = 0

  const session = (
    id: string,
    startedAt: number,
    itemIds: string[],
    ratings: string,
    mode: StudySessionRecord['mode'] = 'unit',
  ): StudySessionRecord => ({
    id,
    packId: 'p',
    startedAt,
    mode,
    face: 'en',
    itemIds,
    seconds: itemIds.map(() => 0),
    ratings,
  })

  beforeEach(async () => {
    dbCount += 1
    db = new VocabDatabase(`forgotten-items-test-${dbCount}`)
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
    (await loadMixItems('p', new Set(unitItemIds), 'en', { db })).map(
      (i) => i.id,
    )

  it('直前 N 回の「忘れた」だけを対象にし、消えた単語と学習するユニットの単語は除く', async () => {
    await saveUnitStudySettings({ mixCount: 20, mixSessionRange: 2 }, db)
    expect((await load(['u'])).sort()).toEqual(['a', 'b'])
  })

  it('保存していなければ初期値（直前 3 回）を使う', async () => {
    expect((await load()).sort()).toEqual(['a', 'b', 'old', 'u'])
  })

  it('復習では、直前 N 回の忘れた単語をすべて返す', async () => {
    const review = async (n: number) =>
      (await loadReviewItems('p', n, 'en', db)).items.map((i) => i.id).sort()
    expect(await review(1)).toEqual(['b', 'u'])
    expect(await review(20)).toEqual(['a', 'b', 'old', 'u'])
  })

  it('復習の回で「忘れた」と申告せずに答えた単語は、復習からも混ぜる単語からも外れる', async () => {
    await db.studySessions.put(session('s4', 4, ['a', 'b'], 'rf', 'review'))
    expect(
      (await loadReviewItems('p', 20, 'en', db)).items.map((i) => i.id).sort(),
    ).toEqual(['b', 'old', 'u'])
    await saveUnitStudySettings({ mixCount: 20, mixSessionRange: 10 }, db)
    expect((await load()).sort()).toEqual(['b', 'old', 'u'])
  })

  it('表面に必要なデータがない単語は、復習からも混ぜる単語からも除く', async () => {
    // a だけ、例文に見出し語が出てくる（日本語 → 解説を作れる）
    await db.items.update(['p', 'a'], {
      senses: [{ meanings: [], example: 'An a.', exampleTranslation: '' }],
    })
    const review = await loadReviewItems('p', 20, 'ja', db)
    expect(review.items.map((i) => i.id)).toEqual(['a'])
    expect(review.skippedCount).toBe(3)
    expect(
      (await loadMixItems('p', new Set(), 'ja', { db })).map((i) => i.id),
    ).toEqual(['a'])
  })

  it('混ぜる数が 0 なら空', async () => {
    await saveUnitStudySettings({ mixCount: 0, mixSessionRange: 3 }, db)
    expect(await load()).toEqual([])
  })
})
