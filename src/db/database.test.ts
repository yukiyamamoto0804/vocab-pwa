import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listenRecordsReplaced,
  notifyRecordsReplaced,
  RECORDS_REPLACED_CHANNEL,
  VocabDatabase,
} from './database'
import { listRecentSessions } from './study'
import type { ItemRecord, StudySessionRecord } from './types'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

function dummyItem(
  packId: string,
  id: string,
  unit: number,
  order: number,
): ItemRecord {
  return {
    packId,
    id,
    unit,
    order,
    word: `word${id}`,
    senses: [
      {
        meanings: [{ pos: '名詞', meaning: `意味${id}` }],
        example: `This is word${id}.`,
        exampleTranslation: `これは意味${id}です。`,
      },
    ],
  }
}

describe('VocabDatabase', () => {
  it('単語は [packId+id] で取り出せ、パックが違えば同じ id でも別の単語になる', async () => {
    await db.items.bulkPut([
      dummyItem('pack-a', '0001', 1, 0),
      dummyItem('pack-b', '0001', 1, 0),
    ])
    expect((await db.items.get(['pack-a', '0001']))?.packId).toBe('pack-a')
    expect(await db.items.count()).toBe(2)
  })

  it('ユニットごとに単語を取り出せる', async () => {
    await db.items.bulkPut([
      dummyItem('pack-a', '0001', 1, 0),
      dummyItem('pack-a', '0002', 2, 1),
      dummyItem('pack-a', '0003', 2, 2),
      dummyItem('pack-b', '0004', 2, 0),
    ])
    const items = await db.items
      .where('[packId+unit]')
      .equals(['pack-a', 2])
      .toArray()
    expect(items.map((i) => i.id)).toEqual(['0002', '0003'])
  })
})

describe('VocabDatabase のバージョン更新', () => {
  it('バージョン 1 で保存した記録は 2 で開いても残り、学習の記録は足した索引で読める', async () => {
    const name = 'database-upgrade-test'
    const session = (
      id: string,
      packId: string,
      startedAt: number,
    ): StudySessionRecord => ({
      id,
      packId,
      startedAt,
      mode: 'unit',
      face: 'en',
      itemIds: [],
      seconds: [],
      ratings: '',
    })
    try {
      // バージョン 1 の DB（database.ts の version(1) と同じ定義）を作り、記録を入れておく
      const v1 = new Dexie(name)
      v1.version(1).stores({
        packs: 'id',
        units: '[packId+id]',
        items: '[packId+id], [packId+unit]',
        audioFiles: '[packId+file]',
        progress: '[packId+itemId]',
        studySessions: 'id, startedAt, packId',
        reports: 'id, [packId+itemId]',
        settings: 'key',
      })
      await v1
        .table('studySessions')
        .bulkPut([
          session('a1', 'a', 1),
          session('b1', 'b', 2),
          session('a2', 'a', 3),
        ])
      await v1
        .table('settings')
        .put({ key: 'unitStudy', value: { mixCount: 7 } })
      await v1.table('items').put(dummyItem('a', '0001', 1, 0))
      v1.close()

      const db = new VocabDatabase(name)
      expect((await listRecentSessions('a', 10, db)).map((s) => s.id)).toEqual([
        'a2',
        'a1',
      ])
      expect((await db.settings.get('unitStudy'))?.value).toEqual({
        mixCount: 7,
      })
      expect((await db.items.get(['a', '0001']))?.word).toBe('word0001')
      db.close()
    } finally {
      await Dexie.delete(name)
    }
  })
})

describe('listenRecordsReplaced', () => {
  it('ほかのタブが学習記録を置き換えたら、接続を閉じる。自分のタブの知らせでは閉じない', async () => {
    await db.open()
    const stop = listenRecordsReplaced(db)
    try {
      notifyRecordsReplaced()
      // ほかのタブの知らせ（送ったタブの印が違う）
      const other = new BroadcastChannel(RECORDS_REPLACED_CHANNEL)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(db.isOpen()).toBe(true)
      other.postMessage('other-tab')
      other.close()
      await vi.waitFor(() => expect(db.isOpen()).toBe(false))
    } finally {
      stop()
    }
  })
})
