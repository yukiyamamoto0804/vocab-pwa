import { describe, expect, it } from 'vitest'
import { createDummyPack } from './dummyPack'
import { validatePack } from './validate'

// 検証を通る最小の教材をもとに、1 か所だけ壊して確かめる
function base() {
  const { manifest, items } = createDummyPack({ itemCount: 2, withAudio: true })
  return {
    manifest: structuredClone(manifest) as unknown as Record<string, unknown>,
    items: structuredClone(items) as unknown as Record<string, unknown>[],
    audio: new Set(['words.mp3']),
  }
}

function errorsOf(p: ReturnType<typeof base>) {
  const result = validatePack(p.manifest, p.items, p.audio)
  return result.ok ? [] : result.errors
}

describe('validatePack', () => {
  it('正しい教材は通り、知らない項目は取り除かれる', () => {
    const p = base()
    p.items[0].note = '知らない項目'
    const result = validatePack(p.manifest, p.items, p.audio)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items).toHaveLength(2)
      expect(result.items[0]).not.toHaveProperty('note')
    }
  })

  it('イディオム・例文の該当語・例文の音声を受け付ける', () => {
    const p = base()
    p.items[0].idioms = [{ phrase: 'p', meaning: 'm' }]
    const senses = p.items[0].senses as Record<string, unknown>[]
    senses[0].exampleTarget = 'word0001'
    senses[0].exampleAudio = { file: 'words.mp3' }
    expect(errorsOf(p)).toEqual([])
  })

  it.each<[string, (p: ReturnType<typeof base>) => void, string]>([
    [
      '形式のバージョンが違う',
      (p) => {
        p.manifest.formatVersion = 2
      },
      'manifest.json の formatVersion',
    ],
    [
      'パックの id がない',
      (p) => {
        delete p.manifest.id
      },
      'manifest.json の id',
    ],
    [
      '単語の word が空',
      (p) => {
        p.items[0].word = ' '
      },
      'items.json の 1 番目（id: 0001）の word',
    ],
    [
      '用法がない',
      (p) => {
        p.items[1].senses = []
      },
      'items.json の 2 番目（id: 0002）の senses',
    ],
    [
      '品詞が一覧にない',
      (p) => {
        ;(
          p.items[0].senses as { meanings: { pos: string }[] }[]
        )[0].meanings[0].pos = '動詞'
      },
      'items.json の 1 番目（id: 0001）の senses[0].meanings[0].pos',
    ],
    [
      '例文の訳がない',
      (p) => {
        delete (p.items[0].senses as Record<string, unknown>[])[0]
          .exampleTranslation
      },
      'items.json の 1 番目（id: 0001）の senses[0].exampleTranslation',
    ],
    [
      'id が重複',
      (p) => {
        p.items[1].id = '0001'
      },
      'items.json の 2 番目（id: 0001）の id',
    ],
    [
      '音声ファイルがない',
      (p) => {
        p.audio = new Set()
      },
      'items.json の 1 番目（id: 0001）の audio.file',
    ],
    [
      'start が負',
      (p) => {
        p.items[0].audio = { file: 'words.mp3', start: -1 }
      },
      'items.json の 1 番目（id: 0001）の audio.start',
    ],
    [
      'start ≥ end',
      (p) => {
        p.items[0].audio = { file: 'words.mp3', start: 2, end: 2 }
      },
      'items.json の 1 番目（id: 0001）の audio',
    ],
  ])('%s場合はエラー', (_, breakIt, where) => {
    const p = base()
    breakIt(p)
    expect(errorsOf(p).map((e) => e.where)).toContain(where)
  })

  it('items.json が配列でない・空の場合はエラー', () => {
    const p = base()
    expect(validatePack(p.manifest, {}, p.audio).ok).toBe(false)
    expect(validatePack(p.manifest, [], p.audio).ok).toBe(false)
  })

  it('複数の誤りをまとめて報告する', () => {
    const p = base()
    p.items[0].word = ''
    p.items[1].word = ''
    expect(errorsOf(p)).toHaveLength(2)
  })

  describe('ユニットの指定', () => {
    const withUnits = () => {
      const { manifest, items } = createDummyPack({ itemCount: 4, unitSize: 2 })
      return { manifest, items, audio: new Set<string>() }
    }

    it('全ての単語に指定され、manifest の units にあれば通る', () => {
      const p = withUnits()
      expect(validatePack(p.manifest, p.items, p.audio).ok).toBe(true)
    })

    it('一部の単語にだけ指定するとエラー', () => {
      const p = withUnits()
      delete p.items[3].unit
      expect(validatePack(p.manifest, p.items, p.audio).ok).toBe(false)
    })

    it('manifest の units にない番号を指すとエラー', () => {
      const p = withUnits()
      p.items[3].unit = 9
      expect(validatePack(p.manifest, p.items, p.audio).ok).toBe(false)
    })

    it('manifest に units があるのに単語に指定がないとエラー', () => {
      const p = withUnits()
      for (const item of p.items) delete item.unit
      expect(validatePack(p.manifest, p.items, p.audio).ok).toBe(false)
    })

    it('ユニット番号の重複はエラー', () => {
      const p = withUnits()
      p.manifest.units = [{ id: 1 }, { id: 1 }]
      expect(validatePack(p.manifest, p.items, p.audio).ok).toBe(false)
    })
  })
})
