import { describe, expect, it } from 'vitest'
import { hasFaceData, isAvailableFace, skippedNotice } from './faces'

describe('hasFaceData', () => {
  const audio = { file: 'a.mp3', start: 0, end: 1 }

  it('英語 → 解説は、どの単語でも作れる', () => {
    expect(hasFaceData({}, 'en')).toBe(true)
  })

  it('単語の音声 → 解説は、単語の音声がある単語だけ', () => {
    expect(hasFaceData({ audio }, 'word-audio')).toBe(true)
    expect(hasFaceData({}, 'word-audio')).toBe(false)
  })

  it('まだ作っていない表面では作らない', () => {
    expect(hasFaceData({ audio }, 'ja')).toBe(false)
  })
})

describe('isAvailableFace', () => {
  it('作り終えた表面だけ選べる', () => {
    expect(isAvailableFace('en')).toBe(true)
    expect(isAvailableFace('word-audio')).toBe(true)
    expect(isAvailableFace('ja')).toBe(false)
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
