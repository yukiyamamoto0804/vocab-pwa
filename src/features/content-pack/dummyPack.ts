import { strToU8, type Zippable, zipSync } from 'fflate'
import type { ContentItem, Manifest } from '../../db/types'

// テスト用のダミー教材パック。中身は全て自作の連番（docs/RULES.md 1 章）。

export interface DummyPackOptions {
  id?: string
  itemCount?: number
  /** 指定すると、この語数ずつ教材側でユニットを指定する */
  unitSize?: number
  /** 単語の音声を付ける（1 ファイルに全単語を収め、区間で指定する） */
  withAudio?: boolean
}

export interface DummyPack {
  manifest: Manifest
  items: ContentItem[]
  audio: Record<string, Uint8Array>
}

export function createDummyPack({
  id = 'dummy-pack',
  itemCount = 3,
  unitSize,
  withAudio = false,
}: DummyPackOptions = {}): DummyPack {
  const items: ContentItem[] = Array.from({ length: itemCount }, (_, i) => {
    const n = String(i + 1).padStart(4, '0')
    const item: ContentItem = {
      id: n,
      word: `word${n}`,
      senses: [
        {
          meanings: [{ pos: '名詞', meaning: `意味${n}` }],
          example: `This is word${n}.`,
          exampleTranslation: `これは意味${n}です。`,
        },
      ],
    }
    if (unitSize) item.unit = Math.floor(i / unitSize) + 1
    if (withAudio) item.audio = { file: 'words.mp3', start: i, end: i + 0.5 }
    return item
  })

  const manifest: Manifest = { formatVersion: 1, id, title: `ダミー ${id}` }
  if (unitSize) {
    const count = Math.ceil(itemCount / unitSize)
    manifest.units = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `ユニット${i + 1}`,
    }))
  }

  const audio: Record<string, Uint8Array> = withAudio
    ? { 'words.mp3': new Uint8Array([1, 2, 3, 4]) }
    : {}
  return { manifest, items, audio }
}

export interface ZipOptions {
  /** 全体を入れるフォルダ名（フォルダごと圧縮した zip を再現する） */
  folder?: string
  /** そのほかに入れるファイル（パス → 中身） */
  extra?: Record<string, Uint8Array>
}

/** manifest・items・audio を教材パック形式の zip にする。不正な形式のテストのため、中身は unknown で受け取る */
export function zipPack(
  pack: {
    manifest: unknown
    items: unknown
    audio?: Record<string, Uint8Array>
  },
  { folder, extra = {} }: ZipOptions = {},
): Uint8Array {
  const root = folder ? `${folder}/` : ''
  const files: Zippable = {
    [`${root}manifest.json`]: strToU8(JSON.stringify(pack.manifest)),
    [`${root}items.json`]: strToU8(JSON.stringify(pack.items)),
    ...extra,
  }
  for (const [name, data] of Object.entries(pack.audio ?? {}))
    files[`${root}audio/${name}`] = data
  return zipSync(files)
}
