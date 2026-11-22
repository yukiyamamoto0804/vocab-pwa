import { describe, expect, it } from 'vitest'
import {
  clozeHint,
  clozeSegments,
  clozeSenseIndexes,
  highlightSegments,
  letterCount,
} from './cloze'

const blanks = (segments: { text: string; mark: boolean }[] | undefined) =>
  segments?.filter((s) => s.mark).map((s) => s.text)

describe('clozeSegments', () => {
  it('該当語を空欄にし、前後の文はそのまま残す', () => {
    expect(
      clozeSegments({ example: 'The room was full of light.' }, 'light'),
    ).toEqual([
      { text: 'The room was full of ', mark: false },
      { text: 'light', mark: true },
      { text: '.', mark: false },
    ])
  })

  it('exampleTarget があればその形を探す。大文字・小文字は区別しない', () => {
    expect(
      blanks(
        clozeSegments({ example: 'Ran home.', exampleTarget: 'ran' }, 'run'),
      ),
    ).toEqual(['Ran'])
  })

  it('ほかの語の一部には当てない。複数あればすべて空欄にする', () => {
    expect(
      blanks(clozeSegments({ example: 'A light flight, light.' }, 'light')),
    ).toEqual(['light', 'light'])
  })

  it('該当語の前後の空白は無視する', () => {
    expect(
      blanks(
        clozeSegments(
          { example: 'A light bag.', exampleTarget: ' light ' },
          'x',
        ),
      ),
    ).toEqual(['light'])
  })

  it('見つからなければ undefined', () => {
    expect(clozeSegments({ example: 'A flight.' }, 'light')).toBeUndefined()
  })

  it('アクセント付きの文字が続く所は、ほかの語の一部として当てない', () => {
    expect(clozeSegments({ example: 'A café.' }, 'caf')).toBeUndefined()
    // e と結合文字（U+0301）で書いた é
    expect(clozeSegments({ example: 'A cafe\u0301.' }, 'cafe')).toBeUndefined()
  })

  it('記号を含む語もそのまま探す', () => {
    expect(
      blanks(clozeSegments({ example: "It's well-known." }, 'well-known')),
    ).toEqual(['well-known'])
  })
})

describe('highlightSegments', () => {
  it('指定した部分を太字にする', () => {
    expect(
      highlightSegments({
        exampleTranslation: '部屋は光で満ちていた。',
        exampleTranslationTarget: '光',
      }),
    ).toEqual([
      { text: '部屋は', mark: false },
      { text: '光', mark: true },
      { text: 'で満ちていた。', mark: false },
    ])
  })

  it('指定がない・見つからないときは太字にしない', () => {
    const whole = [{ text: 'このかばんは軽い。', mark: false }]
    expect(
      highlightSegments({ exampleTranslation: 'このかばんは軽い。' }),
    ).toEqual(whole)
    expect(
      highlightSegments({
        exampleTranslation: 'このかばんは軽い。',
        exampleTranslationTarget: '重い',
      }),
    ).toEqual(whole)
  })
})

describe('clozeSenseIndexes', () => {
  it('例文に該当語が見つかる用法だけを返す', () => {
    const sense = (example: string) => ({
      meanings: [],
      example,
      exampleTranslation: '',
    })
    expect(
      clozeSenseIndexes({
        word: 'light',
        senses: [sense('No match.'), sense('A light bag.')],
      }),
    ).toEqual([1])
  })
})

describe('clozeHint / letterCount', () => {
  it('頭文字と、残りの文字数分の下線を出す。空白は残して数えない', () => {
    expect(clozeHint('light')).toBe('l____')
    expect(letterCount('light')).toBe(5)
    expect(clozeHint('look up')).toBe('l___ __')
    expect(letterCount('look up')).toBe(6)
  })

  it('アクセント付きの文字も文字として隠して数える', () => {
    expect(clozeHint('naïve')).toBe('n____')
    expect(letterCount('naïve')).toBe(5)
  })

  it('ハイフンなどの英字以外は、隠さず数えない', () => {
    expect(clozeHint('well-known')).toBe('w___-_____')
    expect(letterCount('well-known')).toBe(9)
  })

  it('前後に空白が付いていても、頭文字を出す', () => {
    expect(clozeHint(' run')).toBe('r__')
    expect(letterCount(' run')).toBe(3)
  })
})
