import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./player', () => ({
  playAudio: vi.fn(() => Promise.resolve()),
  stopAudio: vi.fn(),
  setPlaybackSession: vi.fn(),
}))
vi.mock('./speech', () => ({
  speak: vi.fn(() => Promise.resolve()),
  SpeechUnavailableError: class SpeechUnavailableError extends Error {},
  SpeechNotStartedError: class SpeechNotStartedError extends Error {},
}))

const { clearUnplayable, playExample, playWord } = await import('./playback')
const { playAudio } = await import('./player')
const { speak, SpeechUnavailableError } = await import('./speech')

describe('playWord / playExample', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearUnplayable()
  })

  it('音声があれば音声を再生し、機械の音声は使わない', async () => {
    const audio = { file: 'a.mp3' }
    await playWord('p', { word: 'light', audio })
    expect(playAudio).toHaveBeenCalledWith('p', audio)
    expect(speak).not.toHaveBeenCalled()
  })

  it('音声がなければ、単語・例文を機械の音声で読む', async () => {
    await playWord('p', { word: 'light' })
    expect(speak).toHaveBeenCalledWith('light')
    await playExample('p', { example: 'A light bag.' })
    expect(speak).toHaveBeenCalledWith('A light bag.')
    expect(playAudio).not.toHaveBeenCalled()
  })

  it('音声ファイルを鳴らせなかったら、機械の音声で読み直す', async () => {
    vi.mocked(playAudio).mockRejectedValueOnce(new Error('decode failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await playWord('p', { word: 'light', audio: { file: 'broken.mp3' } })
    expect(speak).toHaveBeenCalledWith('light')
  })

  it('読み直しもできなければ、機械の音声の失敗を返す', async () => {
    vi.mocked(playAudio).mockRejectedValueOnce(new Error('decode failed'))
    vi.mocked(speak).mockRejectedValueOnce(new Error('no voice'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      playWord('p', { word: 'light', audio: { file: 'broken.mp3' } }),
    ).rejects.toThrow('no voice')
  })

  it('音声ファイルも機械の音声も使えなければ、音声ファイルを再生できないと伝える', async () => {
    vi.mocked(playAudio).mockRejectedValueOnce(new Error('decode failed'))
    vi.mocked(speak).mockRejectedValueOnce(new SpeechUnavailableError())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      playWord('p', { word: 'light', audio: { file: 'broken.mp3' } }),
    ).rejects.toMatchObject({
      userMessage:
        '音声ファイルを再生できません（端末に英語の読み上げの声もありません）',
    })
  })

  it('音声ファイルの失敗が届く前に別の再生が押されたら、読み直さない', async () => {
    let fail: (e: Error) => void = () => {}
    vi.mocked(playAudio).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject
        }),
    )
    const first = playWord('p', {
      word: 'light',
      audio: { file: 'broken.mp3' },
    })
    await playWord('p', { word: 'dark' })
    fail(new Error('decode failed'))
    await first
    expect(speak).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledWith('dark')
  })

  it('一度鳴らせなかった音声は、次からファイルを試さずにすぐ機械の音声で読む', async () => {
    vi.mocked(playAudio).mockRejectedValueOnce(new Error('decode failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const item = { word: 'light', audio: { file: 'broken.mp3' } }
    await playWord('p', item)
    await playWord('p', item)
    expect(playAudio).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(2)
  })
})
