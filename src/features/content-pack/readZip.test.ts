import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createDummyPack, zipPack } from './dummyPack'
import { readPackZip } from './readZip'

const pack = createDummyPack({ withAudio: true })

describe('readPackZip', () => {
  it('manifest・items・音声を取り出す', () => {
    const result = readPackZip(zipPack(pack))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest).toEqual(pack.manifest)
      expect(result.items).toEqual(pack.items)
      expect([...result.audio.keys()]).toEqual(['words.mp3'])
    }
  })

  it('フォルダごと圧縮した zip と、OS の付属ファイルに対応する', () => {
    const bytes = zipPack(pack, {
      folder: 'my-pack',
      extra: {
        '__MACOSX/my-pack/._manifest.json': new Uint8Array([0]),
        'my-pack/audio/.DS_Store': new Uint8Array([0]),
      },
    })
    const result = readPackZip(bytes)
    expect(result.ok).toBe(true)
    if (result.ok) expect([...result.audio.keys()]).toEqual(['words.mp3'])
  })

  it('先頭に BOM がある JSON を読める', () => {
    const bytes = zipSync({
      'manifest.json': strToU8(`﻿${JSON.stringify(pack.manifest)}`),
      'items.json': strToU8(JSON.stringify(pack.items)),
    })
    expect(readPackZip(bytes).ok).toBe(true)
  })

  it.each([
    ['zip でない', new Uint8Array([1, 2, 3])],
    ['manifest.json がない', zipSync({ 'items.json': strToU8('[]') })],
    ['items.json がない', zipSync({ 'manifest.json': strToU8('{}') })],
    [
      'JSON として読めない',
      zipSync({ 'manifest.json': strToU8('{'), 'items.json': strToU8('[]') }),
    ],
    [
      'manifest.json が複数のフォルダにある',
      zipSync({
        'a/manifest.json': strToU8('{}'),
        'b/manifest.json': strToU8('{}'),
      }),
    ],
  ])('%s場合はエラー', (_, bytes) => {
    expect(readPackZip(bytes).ok).toBe(false)
  })

  it('ファイル数・展開後のサイズが上限を超えるとエラー', () => {
    const bytes = zipPack(pack)
    expect(readPackZip(bytes, { maxFiles: 2, maxTotalBytes: 1e9 }).ok).toBe(
      false,
    )
    expect(readPackZip(bytes, { maxFiles: 100, maxTotalBytes: 10 }).ok).toBe(
      false,
    )
  })
})
