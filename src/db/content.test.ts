import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getAudioBlob,
  getProgressMap,
  listUnitItems,
  listUnitSummaries,
} from './content'
import { VocabDatabase } from './database'
import { replacePack } from './packs'
import type { ItemRecord } from './types'

let db: VocabDatabase
let dbCount = 0

beforeEach(async () => {
  dbCount += 1
  db = new VocabDatabase(`content-test-${dbCount}`)
  // id の順と並び順が逆になるように並べる
  const items: ItemRecord[] = [
    ['0003', 1, 0],
    ['0002', 1, 1],
    ['0001', 2, 2],
  ].map(([id, unit, order]) => ({
    packId: 'pack-a',
    id: id as string,
    unit: unit as number,
    order: order as number,
    word: `word${id}`,
    senses: [
      {
        meanings: [{ pos: '名詞', meaning: `意味${id}` }],
        example: `This is word${id}.`,
        exampleTranslation: `これは意味${id}です。`,
      },
    ],
  }))
  await replacePack(
    {
      pack: {
        id: 'pack-a',
        manifest: { formatVersion: 1, id: 'pack-a', title: 'A' },
        importedAt: 0,
      },
      units: [
        { packId: 'pack-a', id: 2 },
        { packId: 'pack-a', id: 1, title: '最初' },
      ],
      items,
      audioFiles: [
        {
          packId: 'pack-a',
          file: 'a.mp3',
          blob: new Blob([new Uint8Array([1])]),
        },
      ],
    },
    db,
  )
  await db.progress.put({
    packId: 'pack-a',
    itemId: '0002',
    mastery: 0.5,
    lastReviewedAt: 0,
    lastReviewedAtByFace: { en: 0 },
  })
})

afterEach(async () => {
  await db.delete()
})

describe('listUnitSummaries', () => {
  it('ユニットを番号順に、単語数と学習済みの数を付けて返す', async () => {
    const list = await listUnitSummaries('pack-a', db)
    expect(
      list.map((s) => [s.unit.id, s.unit.title, s.itemCount, s.learnedCount]),
    ).toEqual([
      [1, '最初', 2, 1],
      [2, undefined, 1, 0],
    ])
  })

  it('ほかのパックの記録と、取り込み直して消えた単語の記録は数えない', async () => {
    const record = { mastery: 1, lastReviewedAt: 0, lastReviewedAtByFace: {} }
    await db.progress.bulkPut([
      { packId: 'pack-b', itemId: '0003', ...record },
      { packId: 'pack-a', itemId: '9999', ...record },
    ])
    const list = await listUnitSummaries('pack-a', db)
    expect(list.map((s) => s.learnedCount)).toEqual([1, 0])
  })
})

describe('listUnitItems', () => {
  it('ユニットの単語を、id の順ではなくパック内の並び順で返す', async () => {
    const items = await listUnitItems('pack-a', 1, db)
    expect(items.map((i) => i.id)).toEqual(['0003', '0002'])
  })
})

describe('getProgressMap', () => {
  it('記録がある単語だけを返す', async () => {
    const map = await getProgressMap('pack-a', ['0001', '0002'], db)
    expect([...map.keys()]).toEqual(['0002'])
  })
})

describe('getAudioBlob', () => {
  it('音声ファイルを返し、なければ undefined', async () => {
    expect((await getAudioBlob('pack-a', 'a.mp3', db))?.size).toBe(1)
    expect(await getAudioBlob('pack-a', 'none.mp3', db)).toBeUndefined()
  })
})
