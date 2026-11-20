import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import { createDummyPack, zipPack } from './dummyPack'
import { importPack, isQuotaError } from './importPack'

let db: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`import-test-${dbCount}`)
})

afterEach(async () => {
  await db.delete()
})

describe('importPack', () => {
  it('教材パックを展開して、パック・ユニット・単語・音声を保存する', async () => {
    const bytes = zipPack(createDummyPack({ itemCount: 25, withAudio: true }))
    const result = await importPack(bytes, { db, now: 1000 })
    expect(result).toEqual({
      ok: true,
      packId: 'dummy-pack',
      title: 'ダミー dummy-pack',
      itemCount: 25,
      unitCount: 2,
      replaced: false,
      added: 25,
      removed: 0,
      changed: 0,
      unchanged: 0,
    })
    expect(await db.packs.get('dummy-pack')).toMatchObject({ importedAt: 1000 })
    const item = await db.items.get(['dummy-pack', '0021'])
    expect(item).toMatchObject({ unit: 2, order: 20, word: 'word0021' })
    const audio = await db.audioFiles.get(['dummy-pack', 'words.mp3'])
    expect(audio?.blob.type).toBe('audio/mpeg')
  })

  it('参照されていない音声ファイルは保存しない', async () => {
    const pack = createDummyPack()
    pack.audio['unused.mp3'] = new Uint8Array([1])
    await importPack(zipPack(pack), { db })
    expect(await db.audioFiles.count()).toBe(0)
  })

  it('不正な教材パックは何も保存せず、理由を返す', async () => {
    const pack = createDummyPack()
    pack.items[0].word = ''
    const result = await importPack(zipPack(pack), { db })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0].where).toContain('word')
    expect(await db.packs.count()).toBe(0)
  })

  it('同じ id のパックを取り込み直すと入れ替える', async () => {
    await importPack(zipPack(createDummyPack({ itemCount: 5 })), { db })
    const result = await importPack(
      zipPack(createDummyPack({ itemCount: 3 })),
      { db },
    )
    expect(result).toMatchObject({ ok: true, replaced: true })
    expect(await db.items.count()).toBe(3)
  })
})

describe('isQuotaError', () => {
  const quota = () => {
    const e = new Error('quota')
    e.name = 'QuotaExceededError'
    return e
  }

  it('容量不足そのものと、Dexie が包んだ容量不足を見分ける', () => {
    expect(isQuotaError(quota())).toBe(true)
    expect(
      isQuotaError(Object.assign(new Error('abort'), { inner: quota() })),
    ).toBe(true)
    expect(
      isQuotaError(
        Object.assign(new Error('bulk'), {
          failures: [new Error('x'), quota()],
        }),
      ),
    ).toBe(true)
  })

  it('ほかの失敗は容量不足とみなさない', () => {
    expect(isQuotaError(new Error('other'))).toBe(false)
    expect(isQuotaError('QuotaExceededError')).toBe(false)
  })
})
