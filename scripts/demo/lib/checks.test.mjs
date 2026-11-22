import { describe, expect, it } from 'vitest'
import {
  checkAudioRecord,
  checkSelection,
  checkShape,
  checkTranslations,
  isInflectionOf,
} from './checks.mjs'
import { parseDictionary } from './ejdict.mjs'

// どれも説明用に作ったダミーのデータ

describe('isInflectionOf', () => {
  it('漢字 1 字の語幹の動詞・形容詞・形容動詞の活用を認める', () => {
    expect(isInflectionOf('買った', '買う')).toBe(true)
    expect(isInflectionOf('撃って', '撃つ')).toBe(true)
    expect(isInflectionOf('強く', '強い')).toBe(true)
    expect(isInflectionOf('適切に', '適切な')).toBe(true)
    expect(isInflectionOf('発表した', '発表する')).toBe(true)
  })

  it('語幹が短すぎる訳語は、一致する場合だけ認める', () => {
    expect(isInflectionOf('はる', 'はる')).toBe(true)
    expect(isInflectionOf('はじめて', 'はる')).toBe(false)
  })

  it('語幹の後ろがひらがなでないものは認めない', () => {
    expect(isInflectionOf('買物', '買う')).toBe(false)
    expect(isInflectionOf('売った', '買う')).toBe(false)
  })
})

const manifest = {
  id: 'demo-ngsl',
  license: 'CC BY-SA 4.0',
  attribution: '出典の表記',
  units: [
    { id: 1, title: 'デモ 1' },
    { id: 2, title: 'デモ 2' },
  ],
}
const ranks = new Map(
  Array.from({ length: 45 }, (_, i) => [1001 + i, `word${1001 + i}`]),
)
const selection = (skipped = []) => {
  const list = []
  for (let r = 1001; list.length < 40; r += 1)
    if (!skipped.includes(r)) list.push(r)
  return list.map((r, i) => ({
    id: `ngsl-${r}`,
    word: `word${r}`,
    unit: i < 20 ? 1 : 2,
  }))
}

describe('checkSelection', () => {
  it('順位どおりなら問題なし', () => {
    expect(checkSelection(selection(), manifest, ranks)).toEqual([])
  })

  it('飛ばした語の分は次の順位で埋める', () => {
    expect(checkSelection(selection([1005]), manifest, ranks, [1005])).toEqual(
      [],
    )
    expect(
      checkSelection(selection(), manifest, ranks, [1005]).length,
    ).toBeGreaterThan(0)
  })

  it('並び・ユニット・id・パックの情報の違いを見つける', () => {
    const items = selection()
    ;[items[0], items[1]] = [items[1], items[0]]
    items[25].unit = 1
    const errors = checkSelection(
      items,
      { ...manifest, id: 'other', license: undefined },
      ranks,
    )
    expect(errors.join('\n')).toMatch(/id が demo-ngsl/)
    expect(errors.join('\n')).toMatch(/license/)
    expect(errors.join('\n')).toMatch(/1 番目の単語: id が ngsl-1001/)
    expect(errors.join('\n')).toMatch(/26 番目の単語: unit が 2/)
  })
})

const dict = parseDictionary(
  [
    'lamp\t〈物〉を『照らす』 / 明かり,灯火',
    'lamp oil\t灯油',
    'lamp(s) post\t街灯',
  ].join('\n'),
)
const item = (sense, idioms) => ({
  id: 'x-1',
  word: 'lamp',
  senses: [sense],
  idioms,
})
const sense = {
  meanings: [{ pos: '他動詞', meaning: '照らす' }],
  example: 'The lamp lit the room.',
  exampleTarget: 'lamp',
  exampleTranslation: 'そのランプが部屋を照らした。',
  exampleTranslationTarget: '照らした',
}

describe('checkTranslations', () => {
  it('辞書の候補から選んだ訳とイディオムなら問題なし', () => {
    const items = [item(sense, [{ phrase: 'lamp oil', meaning: '灯油' }])]
    expect(checkTranslations(items, dict)).toEqual([])
  })

  it('辞書にない訳語・言い換え・活用でない太字を見つける', () => {
    const bad = {
      ...sense,
      meanings: [{ pos: '名詞', meaning: '明かり、照明' }],
      exampleTranslationTarget: '照らした',
    }
    const errors = checkTranslations([item(bad)], dict).join('\n')
    expect(errors).toMatch(/訳語「照明」/)
    expect(errors).toMatch(/活用した形ではない/)
  })

  it('熟語の項目にないイディオム・括弧のある見出しを見つける', () => {
    const items = [
      item(sense, [
        { phrase: 'lamp shade', meaning: '傘' },
        { phrase: 'lamp(s) post', meaning: '街灯' },
        { phrase: 'lamp oil', meaning: '油' },
      ]),
    ]
    const errors = checkTranslations(items, dict)
    expect(errors).toHaveLength(3)
  })

  it('太字や exampleTarget が文に含まれていないものを見つける', () => {
    const bad = {
      ...sense,
      exampleTarget: 'lamps',
      exampleTranslationTarget: '照らす',
    }
    const errors = checkTranslations([item(bad)], dict).join('\n')
    expect(errors).toMatch(/例文の訳に含まれていない/)
    expect(errors).toMatch(/exampleTarget/)
  })
})

describe('checkAudioRecord', () => {
  const items = [
    {
      id: 'x-1',
      word: 'lamp',
      audio: { file: 'demo-words-1.m4a', start: 0.25, end: 0.9 },
      senses: [
        {
          example: 'The lamp lit the room.',
          exampleAudio: { file: 'demo-examples-1-1.m4a', start: 0.25, end: 2 },
        },
      ],
    },
  ]
  const sources = {
    files: [
      {
        file: 'demo-words-1.m4a',
        entries: [
          { id: 'x-1', sense: null, text: 'lamp', start: 0.25, end: 0.9 },
        ],
      },
      {
        file: 'demo-examples-1-1.m4a',
        entries: [
          {
            id: 'x-1',
            sense: 1,
            text: 'The lamp lit the room.',
            start: 0.25,
            end: 2,
          },
        ],
      },
    ],
  }

  it('記録と一致すれば問題なし', () => {
    expect(checkAudioRecord(items, sources)).toEqual([])
  })

  it('例文を直した後に古い音声が残っていれば見つける', () => {
    const changed = structuredClone(items)
    changed[0].senses[0].example = 'The lamp lit the hall.'
    expect(checkAudioRecord(changed, sources).join('\n')).toMatch(/例文と違う/)
  })

  it('区間が記録と違えば見つける', () => {
    const changed = structuredClone(items)
    changed[0].audio.end = 1.2
    expect(checkAudioRecord(changed, sources).join('\n')).toMatch(
      /区間が記録と違う/,
    )
  })
})

describe('isInflectionOf の語幹だけの形', () => {
  it('「する」「な」の語幹だけは認め、ほかは認めない', () => {
    expect(isInflectionOf('発表', '発表する')).toBe(true)
    expect(isInflectionOf('適切', '適切な')).toBe(true)
    expect(isInflectionOf('買', '買う')).toBe(false)
    expect(isInflectionOf('強', '強い')).toBe(false)
  })
})

describe('checkSelection のそのほか', () => {
  it('NGSL に順位がない・units が違う・attribution がない', () => {
    const short = new Map([...ranks].slice(0, 10))
    expect(checkSelection(selection(), manifest, short).join('\n')).toMatch(
      /順位 1011 の語がない/,
    )
    const bad = {
      ...manifest,
      attribution: ' ',
      units: [{ id: 1, title: 'デモ 1' }],
    }
    const errors = checkSelection(selection(), bad, ranks).join('\n')
    expect(errors).toMatch(/attribution/)
    expect(errors).toMatch(/units/)
  })
})

describe('checkAudioRecord の記録の側', () => {
  const base = () => ({
    items: [
      {
        id: 'x-1',
        word: 'lamp',
        audio: { file: 'demo-words-1.m4a', start: 0.25, end: 0.9 },
        senses: [
          {
            example: 'A lamp.',
            exampleAudio: {
              file: 'demo-examples-1-1.m4a',
              start: 0.25,
              end: 1,
            },
          },
        ],
      },
    ],
    sources: {
      files: [
        {
          file: 'demo-words-1.m4a',
          entries: [
            { id: 'x-1', sense: null, text: 'lamp', start: 0.25, end: 0.9 },
          ],
        },
        {
          file: 'demo-examples-1-1.m4a',
          entries: [
            { id: 'x-1', sense: 1, text: 'A lamp.', start: 0.25, end: 1 },
          ],
        },
      ],
    },
  })

  it('消した用法の古い記録・重複・おかしな sense を見つける', () => {
    const { items, sources } = base()
    sources.files[1].entries.push(
      { id: 'x-1', sense: 2, text: 'Old.', start: 1.4, end: 2 },
      { id: 'x-1', sense: 1, text: 'A lamp.', start: 0.25, end: 1 },
      { id: 'x-1', sense: '1', text: 'A lamp.', start: 0.25, end: 1 },
    )
    const errors = checkAudioRecord(items, sources).join('\n')
    expect(errors).toMatch(/x-1#2 が items.json のどの音声にも当たらない/)
    expect(errors).toMatch(/重複/)
    expect(errors).toMatch(/正の整数/)
  })

  it('音声がない・記録にない・ファイル名が違う', () => {
    const { items, sources } = base()
    items[0].audio.file = 'demo-words-2.m4a'
    delete items[0].senses[0].exampleAudio
    sources.files[1].entries = []
    const errors = checkAudioRecord(items, sources).join('\n')
    expect(errors).toMatch(/単語の音声の区間が記録と違う/)
    expect(errors).toMatch(/例文の音声がない/)
  })
})

describe('checkShape', () => {
  it('形の違いを、ほかの確かめの前に見つける', () => {
    expect(checkShape({}, {}, null).join('\n')).toMatch(
      /files が配列ではない[\s\S]*items.json が配列ではない/,
    )
    const items = [
      {
        id: 'a',
        word: 'b',
        senses: [
          {
            meanings: [],
            example: 'x',
            exampleTranslation: 'y',
            exampleTarget: '',
          },
        ],
      },
    ]
    const errors = checkShape(items, {}, { files: [] }).join('\n')
    expect(errors).toMatch(/meanings が 1 つ以上/)
    expect(errors).toMatch(/exampleTarget が空でない文字列ではない/)
  })
})
