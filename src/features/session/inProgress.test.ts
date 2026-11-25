import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import { type InProgressStudy, inProgressKey } from '../../db/study'
import type { ProgressRecord, StudySessionRecord } from '../../db/types'
import {
  firstAnswerSettingsOf,
  loadResumable,
  parseInProgress,
  resumableDeck,
  studyKeyOf,
} from './inProgress'

const inProgress: InProgressStudy = {
  key: 'k',
  sessionId: 's1',
  order: ['a', 'b'],
  frontSenses: {},
  priors: [null],
  before: [],
}
const session: StudySessionRecord = {
  id: 's1',
  packId: 'p',
  startedAt: 0,
  mode: 'unit',
  face: 'en',
  itemIds: ['a'],
  seconds: [0],
  ratings: 'f',
}
const prior = (itemId: string): ProgressRecord => ({
  packId: 'p',
  itemId,
  mastery: 0.5,
  lastReviewedAt: 0,
  lastReviewedAtByFace: {},
})

describe('parseInProgress', () => {
  it('正しい形ならそのまま返す', () => {
    expect(parseInProgress(inProgress)).toEqual(inProgress)
  })

  it('形が違う値は無いものとして扱う', () => {
    expect(parseInProgress(undefined)).toBeUndefined()
    expect(parseInProgress({ ...inProgress, order: 'a' })).toBeUndefined()
    expect(
      parseInProgress({ ...inProgress, order: ['a', 'a'] }),
    ).toBeUndefined()
    expect(
      parseInProgress({ ...inProgress, frontSenses: { a: 0.5 } }),
    ).toBeUndefined()
    expect(parseInProgress({ ...inProgress, priors: [1] })).toBeUndefined()
    expect(parseInProgress({ ...inProgress, before: [{}] })).toBeUndefined()
  })
})

describe('resumableDeck', () => {
  it('やめたときの出題の進み具合を返す（忘れたカードは後ろに回したまま）', () => {
    expect(resumableDeck(inProgress, session, 'p')).toEqual({
      queue: ['a', 'b', 'a'],
      position: 1,
    })
  })

  it('記録と食い違う・終わっている・回答がないなら再開できない', () => {
    expect(resumableDeck(inProgress, { ...session, id: 's2' }, 'p')).toBe(
      undefined,
    )
    expect(resumableDeck(inProgress, session, 'q')).toBeUndefined()
    expect(
      resumableDeck({ ...inProgress, priors: [] }, session, 'p'),
    ).toBeUndefined()
    // 回答する前の学習状況が、ほかの単語のもの
    expect(
      resumableDeck({ ...inProgress, priors: [prior('b')] }, session, 'p'),
    ).toBeUndefined()
    expect(
      resumableDeck(
        { ...inProgress, priors: [prior('a')] },
        { ...session, ratings: 'r' },
        'p',
      ),
    ).toEqual({ queue: ['a', 'b'], position: 1 })
    // 回答の時刻の数が合わない
    expect(
      resumableDeck(inProgress, { ...session, seconds: [] }, 'p'),
    ).toBeUndefined()
    // 回答する前の定着度が数でない
    expect(
      resumableDeck(
        {
          ...inProgress,
          priors: [{ ...prior('a'), mastery: 'x' as unknown as number }],
        },
        session,
        'p',
      ),
    ).toBeUndefined()
    // 並びと食い違う
    expect(
      resumableDeck(inProgress, { ...session, itemIds: ['b'] }, 'p'),
    ).toBeUndefined()
    // 最後まで終えている
    expect(
      resumableDeck(
        { ...inProgress, priors: [null, null] },
        { ...session, itemIds: ['a', 'b'], seconds: [0, 1], ratings: 'rr' },
        'p',
      ),
    ).toBeUndefined()
    expect(
      resumableDeck(
        { ...inProgress, priors: [] },
        { ...session, itemIds: [], seconds: [], ratings: '' },
        'p',
      ),
    ).toBeUndefined()
  })
})

describe('studyKeyOf / firstAnswerSettingsOf', () => {
  it('条件が違えば違う学習として見分ける', () => {
    const unit = { mode: 'unit', packId: 'p', face: 'en', unitId: 1 } as const
    expect(studyKeyOf(unit)).toBe(studyKeyOf({ ...unit }))
    expect(studyKeyOf(unit)).not.toBe(studyKeyOf({ ...unit, unitId: 2 }))
    expect(studyKeyOf(unit)).not.toBe(studyKeyOf({ ...unit, face: 'ja' }))
  })

  it('ユニット学習は前回のユニットを、テストは前回の範囲を書き、復習は何も書かない', () => {
    expect(
      firstAnswerSettingsOf({
        mode: 'unit',
        packId: 'p',
        face: 'en',
        unitId: 3,
      })?.(5),
    ).toMatchObject([{ key: 'lastUnitStudy:p', value: { at: 5, unitId: 3 } }])
    expect(
      firstAnswerSettingsOf({
        mode: 'test',
        packId: 'p',
        face: 'en',
        fromUnit: 1,
        toUnit: 2,
        count: 20,
        includeUnlearned: false,
        order: 'random',
      })?.(5),
    ).toMatchObject([
      { key: 'lastTest:p', value: { at: 5, fromUnit: 1, toUnit: 2 } },
    ])
    expect(
      firstAnswerSettingsOf({
        mode: 'review',
        packId: 'p',
        face: 'en',
        sessionCount: 5,
        count: 20,
      }),
    ).toBeUndefined()
  })
})

describe('loadResumable', () => {
  let db: VocabDatabase
  let dbCount = 0
  const query = { mode: 'unit', packId: 'p', face: 'ja', unitId: 1 } as const
  const saved = (overrides: Partial<InProgressStudy> = {}) =>
    db.settings.put({
      key: inProgressKey('p'),
      value: {
        ...inProgress,
        key: studyKeyOf(query),
        frontSenses: { a: 1, b: 0 },
        ...overrides,
      },
    })
  // 用法 0 は例文に該当語がなく、「例文の訳」の表面に使えない
  const item = (id: string, order: number) => ({
    packId: 'p',
    id,
    unit: 1,
    order,
    word: id,
    senses: [
      { meanings: [], example: 'none here.', exampleTranslation: 'x' },
      { meanings: [], example: `an ${id} here.`, exampleTranslation: 'x' },
    ],
  })

  beforeEach(async () => {
    dbCount += 1
    db = new VocabDatabase(`in-progress-test-${dbCount}`)
    await db.items.bulkPut([item('a', 0), item('b', 1)])
    await db.studySessions.put(session)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('同じ学習の途中の学習を、最初の並びの単語と表面の用法つきで返す', async () => {
    await saved()
    const resumable = await loadResumable(query, db)
    expect(resumable?.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(resumable?.deck).toEqual({ queue: ['a', 'b', 'a'], position: 1 })
    // b の用法 0 は表面に使えないので残さない（学習の画面で選び直す）
    expect([...(resumable?.frontSenses ?? [])]).toEqual([['a', 1]])
  })

  it('違う学習・記録がない・単語が消えた・表面に必要なデータがないなら再開できない', async () => {
    await saved({ key: 'other' })
    expect(await loadResumable(query, db)).toBeUndefined()

    await saved({ sessionId: 'gone' })
    expect(await loadResumable(query, db)).toBeUndefined()

    await saved({ order: ['a', 'b', 'c'] })
    expect(await loadResumable(query, db)).toBeUndefined()

    await saved()
    await db.items.put({
      ...item('b', 1),
      senses: [item('b', 1).senses[0]],
    })
    expect(await loadResumable(query, db)).toBeUndefined()
  })
})
