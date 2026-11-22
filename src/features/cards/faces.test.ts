import { describe, expect, it } from 'vitest'
import { hasFaceData, isAvailableFace, skippedNotice } from './faces'

describe('hasFaceData', () => {
  const audio = { file: 'a.mp3', start: 0, end: 1 }
  const sense = (example: string) => ({
    meanings: [],
    example,
    exampleTranslation: '',
  })
  const item = (extra: object = {}) => ({
    word: 'light',
    senses: [sense('A light bag.')],
    ...extra,
  })

  it('英語 → 解説は、どの単語でも作れる', () => {
    expect(hasFaceData(item(), 'en')).toBe(true)
  })

  it('単語の音声 → 解説は、単語の音声がある単語だけ', () => {
    expect(hasFaceData(item({ audio }), 'word-audio')).toBe(true)
    expect(hasFaceData(item(), 'word-audio')).toBe(false)
  })

  it('日本語 → 解説は、例文の中に該当語が見つかる用法がある単語だけ', () => {
    expect(hasFaceData(item(), 'ja')).toBe(true)
    expect(hasFaceData(item({ senses: [sense('A flight.')] }), 'ja')).toBe(
      false,
    )
  })

  it('まだ作っていない表面では作らない', () => {
    expect(hasFaceData(item({ audio }), 'example-audio')).toBe(false)
  })
})

describe('isAvailableFace', () => {
  it('作り終えた表面だけ選べる', () => {
    expect(isAvailableFace('en')).toBe(true)
    expect(isAvailableFace('word-audio')).toBe(true)
    expect(isAvailableFace('ja')).toBe(true)
    expect(isAvailableFace('example-audio')).toBe(false)
  })
})

describe('skippedNotice', () => {
  it('出さない単語があるときだけ、数と表面を知らせる', () => {
    expect(skippedNotice(3, 'word-audio')).toBe(
      '3 語は、単語の音声 → 解説に必要なデータがないため出しません。',
    )
    expect(skippedNotice(0, 'word-audio')).toBeUndefined()
  })
})
