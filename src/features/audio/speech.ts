// 音声がない単語・例文を、ブラウザ内蔵の音声合成（Web Speech API）で読み上げる（docs/specs/study-cards.md 9 章）。
// 教材の文を外部に送らないよう、端末の中で合成する声（localService）だけを使う（docs/RULES.md 3 章）

/** 声の一覧が届くのを待つ長さ（ms）。一覧は非同期で届くことがある */
const VOICE_WAIT_MS = 1500

/** 端末の中で合成する英語の声がないときの失敗。PlayButton は userMessage を画面に出す */
export class SpeechUnavailableError extends Error {
  readonly userMessage = '端末に英語の読み上げの声がありません'
}

/** 読み上げが始まらなかったときの失敗（iOS が操作の外の読み上げを黙って捨てた など） */
export class SpeechNotStartedError extends Error {
  readonly userMessage = '再生できませんでした。もう一度押してください'
}

/** 読み上げが始まるのを待つ長さ（ms）。これを過ぎても始まらなければ、捨てられたとみなす */
const START_TIMEOUT_MS = 3000

/**
 * 聞き取りの練習に向かない声。iOS などに入っている、おもしろ用の声（novelty voices）と、
 * 機械的に聞こえる Eloquence 系の声。名前の最初の語で判定する
 */
const UNSUITABLE_VOICES = new Set([
  // おもしろ用の声
  'Albert',
  'Bad',
  'Bahh',
  'Bells',
  'Boing',
  'Bubbles',
  'Cellos',
  'Good',
  'Jester',
  'Organ',
  'Superstar',
  'Trinoids',
  'Whisper',
  'Wobble',
  'Zarvox',
  'Fred',
  'Junior',
  'Kathy',
  'Ralph',
  // Eloquence 系の声
  'Eddy',
  'Flo',
  'Grandma',
  'Grandpa',
  'Reed',
  'Rocko',
  'Sandy',
  'Shelley',
])

/** 比較的聞きやすい声（Apple の標準の英語の声など） */
const PREFERRED_VOICES = new Set([
  'Samantha',
  'Ava',
  'Allison',
  'Susan',
  'Tom',
  'Alex',
  'Nicky',
  'Aaron',
  'Karen',
  'Daniel',
  'Moira',
  'Tessa',
  'Serena',
  'Arthur',
  'Martha',
])

type VoiceInfo = Pick<
  SpeechSynthesisVoice,
  'lang' | 'localService' | 'name' | 'voiceURI'
>

/** 名前の最初の語（空白や括弧の前まで）。例: 「Eddy (English (US))」「Eddy（英語（米国））」→ Eddy */
const firstWord = (name: string) => name.split(/[\s(（]/)[0]

/** 聞き取りの練習に向かない声か。名前と、Apple の声の識別子（Eloquence 系・おもしろ用の声）で判定する */
function isUnsuitable(v: VoiceInfo): boolean {
  const uri = v.voiceURI.toLowerCase()
  return (
    UNSUITABLE_VOICES.has(firstWord(v.name)) ||
    uri.includes('com.apple.eloquence.') ||
    // この形の識別子は標準の声（Alex など）にも付くので、名前が一覧に当たるものだけを外す
    (uri.includes('com.apple.speech.synthesis.voice.') &&
      UNSUITABLE_VOICES.has(
        uri
          .split('.')
          .pop()
          ?.replace(/^./, (c) => c.toUpperCase()) ?? '',
      ))
  )
}

/** 声の良さの点数。高品質版（Premium・Enhanced）と、聞きやすい声を優先する */
function voiceScore(v: VoiceInfo): number {
  const id = `${v.name} ${v.voiceURI}`.toLowerCase()
  let score = 0
  if (id.includes('premium')) score += 4
  else if (id.includes('enhanced')) score += 2
  if (PREFERRED_VOICES.has(firstWord(v.name))) score += 1
  // 同じ点数なら、アメリカ英語、イギリス英語の順に選ぶ
  const lang = v.lang.toLowerCase().replace('_', '-')
  if (lang === 'en-us') score += 0.2
  else if (lang === 'en-gb') score += 0.1
  return score
}

/**
 * 端末の中で合成する英語の声を選ぶ。聞き取りに向かない声は使わず、高品質版・聞きやすい声を優先する。
 * なければ undefined
 */
export function pickLocalEnglishVoice<V extends VoiceInfo>(
  voices: readonly V[],
): V | undefined {
  let best: V | undefined
  let bestScore = -1
  for (const v of voices) {
    if (!v.localService || !v.lang.toLowerCase().startsWith('en')) continue
    if (isUnsuitable(v)) continue
    const score = voiceScore(v)
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return best
}

/**
 * 読み上げが終わったとみなすまでの上限（ms）。終わりの通知が来ない場合（iOS が操作の外の読み上げを黙って捨てた、
 * バックグラウンドに移った など）でも、再生ボタンが「再生中」のままにならないようにする。長めに見積もる
 */
export function speechTimeout(text: string): number {
  return text.length * 150 + 5000
}

function synth(): SpeechSynthesis | undefined {
  return typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis
}

/** 声の一覧が届くまで（長くても VOICE_WAIT_MS）待つ */
function waitForVoices(s: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      s.removeEventListener('voiceschanged', done)
      resolve(s.getVoices())
    }
    const timer = setTimeout(done, VOICE_WAIT_MS)
    s.addEventListener('voiceschanged', done)
  })
}

// 再生ボタンを押したときにすぐ（同期で）読めるよう、声の一覧を先に読み込んでおく
const initial = synth()
if (initial && initial.getVoices().length === 0) void waitForVoices(initial)

/** 読み上げの依頼の番号。声の一覧を待っている間に止められたら、読み上げを始めない */
let latestRequest = 0
/** 読み上げ中の発話。ガベージコレクションで回収されて終わりの通知が来なくなるのを防ぐため持っておく */
let current: SpeechSynthesisUtterance | undefined

/** 読み上げを止める。声の一覧を待っている読み上げも始めない */
export function stopSpeech(): void {
  latestRequest += 1
  // 読み上げていないときは cancel しない（cancel の直後の speak が捨てられるブラウザがあるため）
  const s = synth()
  if (s && (s.speaking || s.pending)) s.cancel()
}

function speakWith(
  s: SpeechSynthesis,
  voices: SpeechSynthesisVoice[],
  text: string,
): Promise<void> {
  const voice = pickLocalEnglishVoice(voices)
  if (!voice) return Promise.reject(new SpeechUnavailableError())
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  current = utterance
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      if (current === utterance) current = undefined
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => {
      if (current === utterance) s.cancel()
      finish()
    }, speechTimeout(text))
    // 始まらないまま待たせず、もう一度押せば読めることを知らせる（押した操作の中なら読めるため）
    const startTimer = setTimeout(() => {
      if (current === utterance) s.cancel()
      finish(new SpeechNotStartedError())
    }, START_TIMEOUT_MS)
    utterance.onstart = () => clearTimeout(startTimer)
    utterance.onend = () => {
      clearTimeout(startTimer)
      finish()
    }
    utterance.onerror = (e) => {
      clearTimeout(startTimer)
      // 別の再生で止めたときは、失敗ではなく終わったものとして扱う
      if (e.error === 'interrupted' || e.error === 'canceled') finish()
      else finish(new Error(`読み上げに失敗しました（${e.error}）`))
    }
    s.speak(utterance)
  })
}

/**
 * text を英語で読み上げる。読み終わる（または止められる）と完了する。
 * 端末の中で合成する英語の声がなければ SpeechUnavailableError で失敗する。
 * ボタンを押したときの処理から直接呼ぶこと。iOS では操作の外で読み上げられないことがあるため、
 * 声の一覧が届いていれば、待たずに（同期で）読み上げを始める
 */
export function speak(text: string): Promise<void> {
  const s = synth()
  if (!s) return Promise.reject(new SpeechUnavailableError())
  const voices = s.getVoices()
  if (voices.length > 0) return speakWith(s, voices, text)
  const request = latestRequest
  return waitForVoices(s).then((loaded) =>
    // 待っている間に止められた（別の再生が押された・画面を離れた）なら読まない
    request === latestRequest ? speakWith(s, loaded, text) : undefined,
  )
}
