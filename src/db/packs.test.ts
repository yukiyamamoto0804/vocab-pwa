import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from './database'
import { listPacks, type PackContent, replacePack } from './packs'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`packs-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

function content(
  packId: string,
  itemIds: string[],
  importedAt = 0,
): PackContent {
  return {
    pack: {
      id: packId,
      manifest: { formatVersion: 1, id: packId, title: packId },
      importedAt,
    },
    units: [{ packId, id: 1 }],
    items: itemIds.map((id, order) => ({
      packId,
      id,
      unit: 1,
      order,
      word: `word${id}`,
      senses: [
        {
          meanings: [{ pos: '名詞', meaning: `意味${id}` }],
          example: `This is word${id}.`,
          exampleTranslation: `これは意味${id}です。`,
        },
      ],
    })),
    audioFiles: [{ packId, file: 'a.mp3', blob: new Blob([]) }],
  }
}

describe('replacePack', () => {
  it('取り込み直すと教材は入れ替わり、学習記録は残る', async () => {
    await replacePack(db, content('pack-a', ['0001', '0002']))
    await db.progress.put({
      packId: 'pack-a',
      itemId: '0001',
      mastery: 1,
      lastReviewedAt: 0,
      lastReviewedAtByFace: { en: 0 },
    })
    await db.reports.put({ id: 'r1', at: 0, packId: 'pack-a', itemId: '0001' })

    const summary = await replacePack(db, content('pack-a', ['0001', '0003']))

    expect(summary.replaced).toBe(true)
    const ids = (await db.items.toArray()).map((i) => i.id)
    expect(ids.sort()).toEqual(['0001', '0003'])
    expect(await db.progress.get(['pack-a', '0001'])).toBeDefined()
    expect(await db.reports.get('r1')).toBeDefined()
  })

  it('ほかのパックの教材には触れない', async () => {
    await replacePack(db, content('pack-a', ['0001']))
    await replacePack(db, content('pack-b', ['0001']))
    await replacePack(db, content('pack-a', ['0002']))
    expect(await db.items.get(['pack-b', '0001'])).toBeDefined()
    expect(await db.audioFiles.count()).toBe(2)
  })
})

describe('replacePack の結果', () => {
  it('初めて保存したときは、全ての単語が追加になる', async () => {
    expect(await replacePack(db, content('pack-a', ['0001', '0002']))).toEqual({
      replaced: false,
      added: 2,
      removed: 0,
      changed: 0,
      unchanged: 0,
    })
  })

  it('取り込み直すと、追加・削除・内容の変更・変更なしを数える', async () => {
    await replacePack(db, content('pack-a', ['0001', '0002', '0003']))
    const next = content('pack-a', ['0003', '0002', '0004'])
    next.items[1].word = '直した見出し語'
    // 0003 は並び順だけが変わったので「変更なし」
    expect(await replacePack(db, next)).toEqual({
      replaced: true,
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 1,
    })
  })
})

describe('replacePack の失敗', () => {
  it('途中で失敗すると何も書き込まれず、元の教材が残る', async () => {
    await replacePack(db, content('pack-a', ['0001']))
    const broken = content('pack-a', ['0002'])
    // 主キーの一部がない単語を混ぜて、書き込みを失敗させる
    broken.items.push({
      ...broken.items[0],
      packId: undefined as unknown as string,
    })

    await expect(replacePack(db, broken)).rejects.toThrow()

    expect((await db.items.toArray()).map((i) => i.id)).toEqual(['0001'])
    expect(await db.units.count()).toBe(1)
    expect(await db.audioFiles.count()).toBe(1)
  })
})

describe('listPacks', () => {
  it('取り込んだ順に、単語数とユニット数を付けて返す', async () => {
    await replacePack(db, content('pack-b', ['0001'], 2))
    await replacePack(db, content('pack-a', ['0001', '0002'], 1))
    const list = await listPacks(db)
    expect(list.map((s) => [s.pack.id, s.itemCount, s.unitCount])).toEqual([
      ['pack-a', 2, 1],
      ['pack-b', 1, 1],
    ])
  })
})
