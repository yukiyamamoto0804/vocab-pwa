import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from './database'
import type { ItemRecord } from './types'

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
