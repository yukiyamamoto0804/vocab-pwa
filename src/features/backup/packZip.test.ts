import 'fake-indexeddb/auto'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VocabDatabase } from '../../db/database'
import { createDummyPack, zipPack } from '../content-pack/dummyPack'
import { importPack } from '../content-pack/importPack'
import { createPackZipFile, packZipFileName } from './packZip'

let from: VocabDatabase
let to: VocabDatabase
let dbCount = 0

beforeEach(() => {
  dbCount += 1
  from = new VocabDatabase(`pack-zip-from-${dbCount}`)
  to = new VocabDatabase(`pack-zip-to-${dbCount}`)
})

afterEach(async () => {
  await from.delete()
  await to.delete()
})

/** パックの教材（取り込んだ日時は除く）と、音声の中身 */
async function contentOf(db: VocabDatabase, packId: string) {
  const pack = await db.packs.get(packId)
  const audio = await db.audioFiles.where('packId').equals(packId).toArray()
  return {
    manifest: pack?.manifest,
    units: await db.units.where('packId').equals(packId).toArray(),
    items: await db.items.where('packId').equals(packId).toArray(),
    audio: await Promise.all(
      audio.map(async (a) => ({
        file: a.file,
        type: a.blob.type,
        bytes: [...new Uint8Array(await a.blob.arrayBuffer())],
      })),
    ),
  }
}

/** from に取り込み、書き出した zip を to に取り込んで、教材が同じになることを確かめる */
async function expectRoundTrip(bytes: Uint8Array, packId: string) {
  expect((await importPack(bytes, { db: from })).ok).toBe(true)
  const file = await createPackZipFile(packId, from)
  const result = await importPack(new Uint8Array(await file.arrayBuffer()), {
    db: to,
  })
  expect(result).toMatchObject({ ok: true })
  const before = await contentOf(from, packId)
  const after = await contentOf(to, packId)
  // 書き出すときに units をユニットのテーブルから作り直すので、manifest の units だけは揃えて比べる
  expect({
    ...after,
    manifest: { ...after.manifest, units: undefined },
  }).toEqual({ ...before, manifest: { ...before.manifest, units: undefined } })
  expect(after.manifest?.units).toEqual(
    before.units.map(({ id, title }) =>
      title === undefined ? { id } : { id, title },
    ),
  )
  return file
}

describe('createPackZipFile', () => {
  it('ユニットを教材で指定したパックが、取り込み直すと同じ教材になる', async () => {
    const pack = createDummyPack({ itemCount: 7, unitSize: 3, withAudio: true })
    // 省略できる項目をひととおり使う（項目を選んで書き出す形に直しても、抜け落ちに気づけるように）
    const sense = pack.items[0].senses[0]
    sense.exampleAudio = { file: 'sub/ex-1.m4a', start: 0.5, end: 1.5 }
    sense.exampleTarget = 'word0001'
    sense.exampleTranslationTarget = '意味0001'
    pack.items[0].idioms = [{ phrase: 'word0001 up', meaning: '熟語0001' }]
    // 英数字以外のファイル名も、zip の中で正しく読めること
    pack.items[1].senses[0].exampleAudio = { file: '音声/例.m4a' }
    pack.audio['sub/ex-1.m4a'] = new Uint8Array([9, 8, 7])
    pack.audio['音声/例.m4a'] = new Uint8Array([6, 5])
    pack.manifest.license = 'CC0'
    pack.manifest.attribution = '自作のダミー'
    pack.manifest.createdAt = '2026-01-01'
    // 名前のないユニット
    if (pack.manifest.units) pack.manifest.units[1] = { id: 2 }
    const file = await expectRoundTrip(zipPack(pack), 'dummy-pack')
    expect(file.name).toBe('dummy-pack.zip')
    expect(file.type).toBe('application/zip')
  })

  it('自動で区切ったパックも、同じ区切りで取り込み直せる', async () => {
    const pack = createDummyPack({ itemCount: 25, withAudio: true })
    expect(pack.manifest.units).toBeUndefined()
    await expectRoundTrip(zipPack(pack), 'dummy-pack')
  })

  it('音声は圧縮せずに入れ、JSON は整形しない。アプリが足した項目は入れない', async () => {
    const pack = createDummyPack({ itemCount: 2, withAudio: true })
    await importPack(zipPack(pack), { db: from })
    const file = await createPackZipFile('dummy-pack', from)
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual([
      'audio/words.mp3',
      'items.json',
      'manifest.json',
    ])
    expect([...files['audio/words.mp3']]).toEqual([1, 2, 3, 4])
    const itemsText = new TextDecoder().decode(files['items.json'])
    expect(itemsText).not.toContain('\n')
    const items = JSON.parse(itemsText)
    expect(items[0]).not.toHaveProperty('order')
    expect(items[0]).not.toHaveProperty('packId')
    expect(items[0].unit).toBe(1)
  })

  it('デモ教材のパックも書き出せ、取り込み直すとふつうの取り込みになる', async () => {
    const pack = createDummyPack({ id: 'demo-ngsl', itemCount: 2 })
    await importPack(zipPack(pack), { db: from })
    await from.packs.update('demo-ngsl', { demoItemsSha256: 'abc' })
    const file = await createPackZipFile('demo-ngsl', from)
    await importPack(new Uint8Array(await file.arrayBuffer()), { db: to })
    const imported = await to.packs.get('demo-ngsl')
    expect(imported).toBeDefined()
    expect(imported?.demoItemsSha256).toBeUndefined()
  })

  it('パックがなければ失敗する', async () => {
    await expect(createPackZipFile('none', from)).rejects.toThrow()
  })
})

describe('packZipFileName', () => {
  it('ファイル名に使えない文字を _ に置き換える', () => {
    expect(packZipFileName('my-pack')).toBe('my-pack.zip')
    expect(packZipFileName('a/b:c*?"<>|\\d')).toBe('a_b_c_______d.zip')
  })
})
