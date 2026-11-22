import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import { createDummyPack, zipPack } from '../content-pack/dummyPack'
import { importPack } from '../content-pack/importPack'
import {
  DEMO_PACK_ID,
  type DemoPackInfo,
  demoState,
  demoZipUrl,
  importDemo,
} from './demoPack'

// どれも説明用に作ったダミーのデータ

const info: DemoPackInfo = {
  title: 'デモ',
  license: 'CC BY-SA 4.0',
  attribution: '出典',
  itemsSha256: 'abcdef0123456789'.repeat(4),
}

function demoZip(id = DEMO_PACK_ID) {
  const pack = createDummyPack({ itemCount: 3 })
  return zipPack({ ...pack, manifest: { ...pack.manifest, id } })
}

const respond = (body: Uint8Array, status = 200) =>
  (async () =>
    new Response(status === 200 ? new Blob([new Uint8Array(body)]) : null, {
      status,
    })) as unknown as typeof fetch

let db: VocabDatabase
let dbCount = 0
beforeEach(() => {
  dbCount += 1
  db = new VocabDatabase(`demo-test-${dbCount}`)
})
afterEach(async () => {
  await db.delete()
})

describe('demoZipUrl', () => {
  it('相対 URL に、版の先頭 12 文字を付ける', () => {
    expect(demoZipUrl(info)).toBe('demo/demo-ngsl.zip?v=abcdef012345')
  })
})

describe('demoState', () => {
  it('取り込み済みの版と比べる', () => {
    const pack = { id: DEMO_PACK_ID, manifest: {} as never, importedAt: 0 }
    expect(demoState(info, undefined)).toBe('new')
    expect(
      demoState(info, { ...pack, demoItemsSha256: info.itemsSha256 }),
    ).toBe('open')
    expect(demoState(info, { ...pack, demoItemsSha256: 'old' })).toBe('update')
    // ふつうの取り込みで入れたもの（版の記録がない）は、更新できるようにする
    expect(demoState(info, pack)).toBe('update')
  })
})

describe('importDemo', () => {
  it('受け取って取り込み、取り込んだ版を記録する', async () => {
    const result = await importDemo(info, {
      db,
      fetch: respond(demoZip()),
      now: 5,
    })
    expect(result.ok).toBe(true)
    expect(await db.packs.get(DEMO_PACK_ID)).toMatchObject({
      importedAt: 5,
      demoItemsSha256: info.itemsSha256,
    })
  })

  it('受け取れないときは、理由を返して何も保存しない', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const failed = await importDemo(info, { db, fetch: offline })
    expect(failed.ok).toBe(false)
    const notFound = await importDemo(info, {
      db,
      fetch: respond(new Uint8Array(), 404),
    })
    expect(!notFound.ok && notFound.errors[0].message).toMatch(/404/)
    expect(await db.packs.count()).toBe(0)
  })

  it('id が違うパックは、取り込まない', async () => {
    const result = await importDemo(info, {
      db,
      fetch: respond(demoZip('other')),
    })
    expect(result.ok).toBe(false)
    expect(await db.packs.count()).toBe(0)
  })

  it('ふつうの取り込みで入れ直すと、版の記録が消えて「更新」になる', async () => {
    await importDemo(info, { db, fetch: respond(demoZip()) })
    await importPack(demoZip(), { db })
    const pack = await db.packs.get(DEMO_PACK_ID)
    expect(pack?.demoItemsSha256).toBeUndefined()
    expect(demoState(info, pack)).toBe('update')
  })

  it('新しい版で取り込み直すと、最初の取り込み日時と学習記録を保ち、版を記録し直す', async () => {
    await importDemo(info, { db, fetch: respond(demoZip()), now: 1 })
    const pack = createDummyPack({ itemCount: 3 })
    await db.progress.put({
      packId: DEMO_PACK_ID,
      itemId: pack.items[0].id,
      mastery: 0.5,
      lastReviewedAt: 1,
      lastReviewedAtByFace: {},
    })
    const next = { ...info, itemsSha256: 'f'.repeat(64) }
    const result = await importDemo(next, {
      db,
      fetch: respond(demoZip()),
      now: 2,
    })
    expect(result.ok && result.replaced).toBe(true)
    expect(await db.packs.get(DEMO_PACK_ID)).toMatchObject({
      importedAt: 1,
      demoItemsSha256: next.itemsSha256,
    })
    expect(await db.progress.count()).toBe(1)
  })

  it('zip として開けないときは、理由を返して何も保存しない', async () => {
    const result = await importDemo(info, {
      db,
      fetch: respond(new Uint8Array([1, 2, 3])),
    })
    expect(result.ok).toBe(false)
    expect(await db.packs.count()).toBe(0)
  })

  it('id が違うパックは、同じ id のほかのパックを上書きしない', async () => {
    const other = createDummyPack({ itemCount: 2 })
    await importPack(
      zipPack({ ...other, manifest: { ...other.manifest, id: 'other' } }),
      { db, now: 7 },
    )
    const result = await importDemo(info, {
      db,
      fetch: respond(demoZip('other')),
    })
    expect(result.ok).toBe(false)
    expect(await db.items.where('packId').equals('other').count()).toBe(2)
    expect(await db.packs.get('other')).toMatchObject({ importedAt: 7 })
  })
})
