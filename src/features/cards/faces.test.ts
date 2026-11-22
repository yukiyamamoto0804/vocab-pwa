import { describe, expect, it } from 'vitest'
import {
  hasFaceData,
  noFaceDataMessage,
  pickFrontSense,
  skippedNotice,
} from './faces'

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

  it('音声だけの表面は、音声ファイルがある単語・用法だけ（機械の音声は使わない）', () => {
    expect(hasFaceData(item({ audio }), 'word-audio')).toBe(true)
    expect(hasFaceData(item(), 'word-audio')).toBe(false)
    expect(hasFaceData(item(), 'example-audio')).toBe(false)
    expect(
      hasFaceData(
        item({
          senses: [
            sense('No audio.'),
            { ...sense('A light bag.'), exampleAudio: audio },
          ],
        }),
        'example-audio',
      ),
    ).toBe(true)
  })

  it('日本語 → 解説は、例文の中に該当語が見つかる用法がある単語だけ', () => {
    expect(hasFaceData(item(), 'ja')).toBe(true)
    expect(hasFaceData(item({ senses: [sense('A flight.')] }), 'ja')).toBe(
      false,
    )
  })
})

describe('skippedNotice / noFaceDataMessage', () => {
  it('出さない単語があるときだけ、数と理由を知らせる', () => {
    expect(skippedNotice(3, 'ja')).toBe(
      '3 語は、日本語 → 解説に必要なデータがないため出しません。',
    )
    expect(skippedNotice(2, 'word-audio')).toBe(
      '2 語は、単語の音声 → 解説に使う音声がないため出しません。',
    )
    expect(skippedNotice(0, 'ja')).toBeUndefined()
  })

  it('音声だけの表面で出せないときは、音声がないことを伝える', () => {
    expect(noFaceDataMessage('example-audio')).toContain('音声のある単語がない')
    expect(noFaceDataMessage('ja')).not.toContain('音声')
  })
})

describe('pickFrontSense', () => {
  const sense = (example: string) => ({
    meanings: [],
    example,
    exampleTranslation: '',
  })

  it('日本語 → 解説は、例文に該当語が見つかる用法から選ぶ', () => {
    const item = {
      word: 'light',
      senses: [sense('No match.'), sense('A light bag.')],
    }
    expect(pickFrontSense(item, 'ja', () => 0)).toBe(1)
  })

  it('例文の音声 → 解説は、例文の音声がある用法から選ぶ', () => {
    const item = {
      word: 'light',
      senses: [
        sense('No audio.'),
        { ...sense('A light bag.'), exampleAudio: { file: 'a.m4a' } },
        { ...sense('Light it.'), exampleAudio: { file: 'b.m4a' } },
      ],
    }
    expect(pickFrontSense(item, 'example-audio', () => 0)).toBe(1)
    expect(pickFrontSense(item, 'example-audio', () => 0.99)).toBe(2)
  })
})
