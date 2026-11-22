import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from './database'
import {
  getStoredInProgress,
  type InProgressStudy,
  listRecentSessions,
  listReportedItemIds,
  restoreBeforeAnswer,
  saveAnswer,
  toggleReport,
} from './study'
import type { ProgressRecord, StudySessionRecord } from './types'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`study-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

const emptySession: StudySessionRecord = {
  id: 's1',
  packId: 'p',
  startedAt: 0,
  mode: 'unit',
  face: 'en',
  itemIds: [],
  seconds: [],
  ratings: '',
}
const progress = (mastery: number): ProgressRecord => ({
  packId: 'p',
  itemId: '0001',
  mastery,
  lastReviewedAt: 0,
  lastReviewedAtByFace: { en: 0 },
})
const inProgress = (sessionId = 's1'): InProgressStudy => ({
  key: 'mode=unit',
  sessionId,
  order: ['0001'],
  frontSenses: {},
  priors: [],
  before: [],
})
const answered = (ratings: string): StudySessionRecord => ({
  ...emptySession,
  itemIds: [...ratings].map(() => '0001'),
  seconds: [...ratings].map(() => 0),
  ratings,
})

describe('saveAnswer / restoreBeforeAnswer', () => {
  it('初めての回答を取り消すと、記録も学習状況も途中の学習も残らない', async () => {
    await saveAnswer(
      {
        session: answered('r'),
        progress: progress(1),
        inProgress: inProgress(),
      },
      db,
    )
    expect(await db.studySessions.count()).toBe(1)
    expect(await getStoredInProgress('p', db)).toMatchObject({
      key: 'mode=unit',
    })

    await restoreBeforeAnswer(
      {
        session: emptySession,
        itemId: '0001',
        progress: undefined,
        inProgress: inProgress(),
      },
      db,
    )
    expect(await db.studySessions.count()).toBe(0)
    expect(await db.progress.count()).toBe(0)
    expect(await getStoredInProgress('p', db)).toBeUndefined()
  })

  it('2 回目以降の回答を取り消すと、1 つ前の記録と学習状況に戻る', async () => {
    await saveAnswer(
      {
        session: answered('f'),
        progress: progress(0),
        inProgress: inProgress(),
      },
      db,
    )
    await saveAnswer(
      {
        session: answered('fr'),
        progress: progress(0.4),
        inProgress: undefined,
      },
      db,
    )
    // 最後まで終えたら途中の学習を消す
    expect(await getStoredInProgress('p', db)).toBeUndefined()

    await restoreBeforeAnswer(
      {
        session: answered('f'),
        itemId: '0001',
        progress: progress(0),
        inProgress: { ...inProgress(), priors: [null] },
      },
      db,
    )
    expect((await db.studySessions.get('s1'))?.ratings).toBe('f')
    expect((await db.progress.get(['p', '0001']))?.mastery).toBe(0)
    // 取り消して終わっていない状態に戻ったので、途中の学習をまた置く
    expect(await getStoredInProgress('p', db)).toMatchObject({ priors: [null] })
  })

  it('最初の回答で設定を書き、すべて取り消したら書き換える前の値に戻す', async () => {
    await db.settings.put({ key: 'last:p', value: 'old' })
    const before = await saveAnswer(
      {
        session: answered('r'),
        progress: progress(1),
        inProgress: inProgress(),
        firstAnswerSettings: [
          { key: 'last:p', value: 'new' },
          { key: 'other:p', value: 1 },
        ],
      },
      db,
    )
    expect(before).toEqual([
      { key: 'last:p', existed: true, value: 'old' },
      { key: 'other:p', existed: false, value: undefined },
    ])
    expect((await db.settings.get('last:p'))?.value).toBe('new')

    // 2 回目の回答では設定を書かず、書き換える前の値を引き継ぐ
    expect(
      await saveAnswer(
        {
          session: answered('rr'),
          progress: progress(1),
          inProgress: { ...inProgress(), before },
          firstAnswerSettings: [{ key: 'last:p', value: 'newer' }],
        },
        db,
      ),
    ).toEqual(before)
    expect((await db.settings.get('last:p'))?.value).toBe('new')

    await restoreBeforeAnswer(
      {
        session: emptySession,
        itemId: '0001',
        progress: undefined,
        inProgress: { ...inProgress(), before },
      },
      db,
    )
    expect((await db.settings.get('last:p'))?.value).toBe('old')
    expect(await db.settings.get('other:p')).toBeUndefined()
  })
})

describe('saveAnswer の最初の回答の判定', () => {
  it('保存できたのに同じ最初の回答をもう一度送っても、書き換える前の値は最初のまま', async () => {
    await db.settings.put({ key: 'last:p', value: 'old' })
    const answer = {
      session: answered('r'),
      progress: progress(1),
      inProgress: inProgress(),
      firstAnswerSettings: [{ key: 'last:p', value: 'new' }],
    }
    await saveAnswer(answer, db)
    expect(await saveAnswer(answer, db)).toEqual([
      { key: 'last:p', existed: true, value: 'old' },
    ])
  })
})

describe('toggleReport', () => {
  it('押すたびに報告と取り消しを切り替え、パックごとに報告済みの単語を返す', async () => {
    expect(await toggleReport('p', '0001', 0, db)).toBe(true)
    await toggleReport('q', '0002', 0, db)
    expect([...(await listReportedItemIds('p', db))]).toEqual(['0001'])

    expect(await toggleReport('p', '0001', 1, db)).toBe(false)
    expect((await listReportedItemIds('p', db)).size).toBe(0)
  })
})

describe('listRecentSessions', () => {
  it('復習の回は回数に数えず、その間にある復習の回も返す', async () => {
    await db.studySessions.bulkPut([
      { ...emptySession, id: 'u1', startedAt: 1 },
      { ...emptySession, id: 'r-old', startedAt: 2, mode: 'review' },
      { ...emptySession, id: 'u2', startedAt: 3 },
      { ...emptySession, id: 'r1', startedAt: 4, mode: 'review' },
      { ...emptySession, id: 'r2', startedAt: 5, mode: 'review' },
      { ...emptySession, id: 't3', startedAt: 6, mode: 'test' },
    ])
    const ids = async (count: number) =>
      (await listRecentSessions('p', count, db)).map((s) => s.id)
    expect(await ids(1)).toEqual(['t3'])
    expect(await ids(2)).toEqual(['t3', 'r2', 'r1', 'u2'])
    expect(await ids(10)).toEqual(['t3', 'r2', 'r1', 'u2', 'r-old', 'u1'])
  })

  it('そのパックの記録を新しい順に count 回分返す', async () => {
    await db.studySessions.bulkPut([
      { ...emptySession, id: 'old', startedAt: 1 },
      { ...emptySession, id: 'other-pack', packId: 'q', startedAt: 4 },
      { ...emptySession, id: 'new', startedAt: 3 },
      { ...emptySession, id: 'mid', startedAt: 2 },
    ])
    const ids = async (count: number) =>
      (await listRecentSessions('p', count, db)).map((s) => s.id)
    expect(await ids(2)).toEqual(['new', 'mid'])
    expect(await ids(10)).toEqual(['new', 'mid', 'old'])
    expect(await ids(0)).toEqual([])
  })
})
