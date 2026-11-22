import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickLocalEnglishVoice, speechTimeout } from './speech'

const voice = (
  lang: string,
  localService: boolean,
  name = 'Voice',
  voiceURI = name,
) => ({ lang, localService, name, voiceURI })

describe('pickLocalEnglishVoice', () => {
  it('端末の中で合成する英語の声だけから選び、同じ点数ならアメリカ英語を優先する', () => {
    const us = voice('en-US', true)
    expect(
      pickLocalEnglishVoice([voice('en-US', false), voice('en-GB', true), us]),
    ).toBe(us)
  })

  it('アメリカ英語がなければイギリス英語、なければほかの英語', () => {
    const gb = voice('en_GB', true)
    const au = voice('en-AU', true)
    expect(pickLocalEnglishVoice([au, gb])).toBe(gb)
    expect(pickLocalEnglishVoice([au, voice('ja-JP', true)])).toBe(au)
  })

  it('外部で合成する声しかなければ undefined（教材の文を外に送らないため）', () => {
    expect(
      pickLocalEnglishVoice([voice('en-US', false), voice('ja-JP', true)]),
    ).toBeUndefined()
  })

  it('おもしろ用の声や Eloquence 系の声は使わない', () => {
    const samantha = voice('en-US', true, 'Samantha')
    expect(
      pickLocalEnglishVoice([
        voice('en-US', true, 'Albert'),
        voice('en-US', true, 'Bad News'),
        voice('en-US', true, 'Eddy (English (US))'),
        samantha,
      ]),
    ).toBe(samantha)
    expect(
      pickLocalEnglishVoice([voice('en-US', true, 'Zarvox')]),
    ).toBeUndefined()
  })

  it('全角括弧の名前や、Apple の識別子でも、向かない声を外す', () => {
    expect(
      pickLocalEnglishVoice([voice('en-US', true, 'Eddy（英語（米国））')]),
    ).toBeUndefined()
    expect(
      pickLocalEnglishVoice([
        voice(
          'en-US',
          true,
          'Pipe Organ',
          'com.apple.speech.synthesis.voice.Organ',
        ),
        voice('en-US', true, 'Reed', 'com.apple.eloquence.en-US.Reed'),
      ]),
    ).toBeUndefined()
  })

  it('標準の声に付く識別子だけでは外さない', () => {
    const alex = voice(
      'en-US',
      true,
      'Alex',
      'com.apple.speech.synthesis.voice.Alex',
    )
    expect(pickLocalEnglishVoice([alex])).toBe(alex)
  })

  it('高品質版（Premium・Enhanced）と、聞きやすい声を優先する', () => {
    const enhanced = voice('en-GB', true, 'Daniel (Enhanced)')
    const premium = voice(
      'en-US',
      true,
      'Ava',
      'com.apple.voice.premium.en-US.Ava',
    )
    const plain = voice('en-US', true, 'Nathan')
    const samantha = voice('en-US', true, 'Samantha')
    expect(pickLocalEnglishVoice([plain, samantha])).toBe(samantha)
    expect(pickLocalEnglishVoice([plain, samantha, enhanced])).toBe(enhanced)
    expect(pickLocalEnglishVoice([enhanced, premium])).toBe(premium)
  })
})

/** テスト用の音声合成。speak された発話を覚えておき、終わりの通知はテストから出す */
class FakeSynth extends EventTarget {
  voices: ReturnType<typeof voice>[] = []
  spoken: FakeUtterance[] = []
  cancelCount = 0
  speaking = false
  pending = false
  paused = false
  resume() {
    this.paused = false
  }
  getVoices() {
    return this.voices
  }
  /** false にすると、読み上げが始まらない（iOS が黙って捨てた場合など）を再現する */
  starts = true
  speak(u: FakeUtterance) {
    this.spoken.push(u)
    if (this.starts) u.onstart?.()
  }
  cancel() {
    this.cancelCount += 1
  }
}

class FakeUtterance {
  voice: unknown
  lang = ''
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  readonly text: string
  constructor(text: string) {
    this.text = text
  }
}

describe('speak / stopSpeech', () => {
  let synth: FakeSynth

  beforeEach(() => {
    vi.resetModules()
    synth = new FakeSynth()
    vi.stubGlobal('speechSynthesis', synth)
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('声が届いていれば、待たずにその場で読み上げを始め、読み終わると完了する', async () => {
    synth.voices = [voice('en-US', true)]
    const { speak } = await import('./speech')
    const done = speak('hello')
    // iOS の操作の制限に合わせ、呼んだその場で speak されている
    expect(synth.spoken.map((u) => u.text)).toEqual(['hello'])
    synth.spoken[0].onend?.()
    await expect(done).resolves.toBeUndefined()
  })

  it('端末の中で合成する英語の声がなければ失敗し、画面に出す文言を持つ', async () => {
    synth.voices = [voice('en-US', false)]
    const { speak } = await import('./speech')
    await expect(speak('hello')).rejects.toMatchObject({
      userMessage: '端末に英語の読み上げの声がありません',
    })
    expect(synth.spoken).toEqual([])
  })

  it('別の再生で止められた（interrupted）ときは、失敗にせず完了する', async () => {
    synth.voices = [voice('en-US', true)]
    const { speak } = await import('./speech')
    const done = speak('hello')
    synth.spoken[0].onerror?.({ error: 'interrupted' })
    await expect(done).resolves.toBeUndefined()
  })

  it('止められた以外の失敗（synthesis-failed など）は、失敗として返す', async () => {
    synth.voices = [voice('en-US', true)]
    const { speak } = await import('./speech')
    const done = speak('hello')
    synth.spoken[0].onerror?.({ error: 'synthesis-failed' })
    await expect(done).rejects.toThrow('synthesis-failed')
  })

  it('一時停止のまま残っていたら、再開してから読み上げる', async () => {
    synth.voices = [voice('en-US', true)]
    synth.paused = true
    const { speak } = await import('./speech')
    void speak('hello')
    expect(synth.paused).toBe(false)
  })

  it('読み上げていないときは cancel しない', async () => {
    const { stopSpeech } = await import('./speech')
    stopSpeech()
    expect(synth.cancelCount).toBe(0)
    synth.speaking = true
    stopSpeech()
    expect(synth.cancelCount).toBe(1)
  })

  it('声の一覧を待っている間に止められたら、届いても読み上げない', async () => {
    const { speak, stopSpeech } = await import('./speech')
    const done = speak('hello')
    stopSpeech()
    synth.voices = [voice('en-US', true)]
    synth.dispatchEvent(new Event('voiceschanged'))
    await expect(done).resolves.toBeUndefined()
    expect(synth.spoken).toEqual([])
  })

  it('読み上げが始まらなければ、もう一度押すよう知らせて失敗する', async () => {
    vi.useFakeTimers()
    synth.voices = [voice('en-US', true)]
    synth.starts = false
    const { speak } = await import('./speech')
    const done = speak('hello')
    vi.advanceTimersByTime(3000)
    await expect(done).rejects.toMatchObject({
      userMessage: '再生できませんでした。もう一度押してください',
    })
  })

  it('終わりの通知が来なくても、上限の時間で止めて完了する', async () => {
    vi.useFakeTimers()
    synth.voices = [voice('en-US', true)]
    const { speak } = await import('./speech')
    const done = speak('hello')
    vi.advanceTimersByTime(speechTimeout('hello'))
    await expect(done).resolves.toBeUndefined()
    expect(synth.cancelCount).toBe(1)
  })
})
