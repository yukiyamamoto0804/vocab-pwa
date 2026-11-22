import type { AudioRef, Sense } from '../../db/types'
import {
  AudioFileError,
  PlaybackBlockedError,
  playAudio,
  SegmentError,
  setPlaybackSession,
  stopAudio,
} from './player'
import { SpeechNotStartedError, SpeechUnavailableError, speak } from './speech'

// 再生ボタンの音声（docs/specs/study-cards.md 9 章）。
// 音声があれば音声、なければ機械の音声で読み上げる。音声ファイルを鳴らせなかった（壊れている・区間が長さの外など）
// ときも、機械の音声で読み直す。どれもボタンを押したときの処理から直接呼ぶこと

/** 音声ファイルを鳴らせず、機械の音声でも読めなかったときの失敗。PlayButton は userMessage を画面に出す */
export class AudioUnplayableError extends Error {
  readonly userMessage: string
  constructor(userMessage: string) {
    super(userMessage)
    this.userMessage = userMessage
  }
}

/** 再生の依頼の番号。音声ファイルの失敗が届く前に別の再生が押されていたら、読み直さない */
let latestRequest = 0

/**
 * 鳴らせなかった音声。次に押したときは音声ファイルを試さず、押した操作の中ですぐ機械の音声で読む
 * （ファイルを読み込んで失敗するのを待つと操作の外になり、iOS では読み上げが捨てられることがあるため）
 */
const unplayable = new Set<string>()
/** ファイル単位の記録（見つからない・読み解けないなど、ファイルが原因のとき） */
const fileKeyOf = (packId: string, a: AudioRef) => `${packId}\n${a.file}`
/** 区間単位の記録（区間が長さの外など、その区間だけが原因のとき） */
const segmentKeyOf = (packId: string, a: AudioRef) =>
  `${fileKeyOf(packId, a)}\n${a.start ?? ''}\n${a.end ?? ''}`
const isUnplayable = (packId: string, a: AudioRef) =>
  unplayable.has(fileKeyOf(packId, a)) ||
  unplayable.has(segmentKeyOf(packId, a))

/** 鳴らせなかった音声の記録を消す。教材パックを取り込み直した後に呼ぶ */
export function clearUnplayable(): void {
  unplayable.clear()
}

function speakText(text: string): Promise<void> {
  stopAudio()
  setPlaybackSession()
  return speak(text)
}

async function playOrSpeak(
  packId: string,
  audio: AudioRef | undefined,
  text: string,
): Promise<void> {
  latestRequest += 1
  const request = latestRequest
  if (!audio || isUnplayable(packId, audio)) return speakText(text)
  try {
    await playAudio(packId, audio)
  } catch (error) {
    if (request !== latestRequest) return
    // 端末が再生を止めただけ（ファイルの問題ではない）なら、記録せずにもう一度押してもらう
    if (error instanceof PlaybackBlockedError) throw error
    console.error(error)
    // 原因がファイルか区間にあると分かったときだけ覚える。一時的な失敗（DB を読めなかった など）は覚えない
    if (error instanceof AudioFileError)
      unplayable.add(fileKeyOf(packId, audio))
    else if (error instanceof SegmentError)
      unplayable.add(segmentKeyOf(packId, audio))
    try {
      await speakText(text)
    } catch (speechError) {
      // 読み直しもできないとき。本当の原因は音声ファイルなので、そう伝える（教材の不備に気づけるように）
      if (speechError instanceof SpeechUnavailableError)
        throw new AudioUnplayableError(
          '音声ファイルを再生できません（端末に英語の読み上げの声もありません）',
        )
      if (speechError instanceof SpeechNotStartedError)
        throw new AudioUnplayableError(
          '音声ファイルを再生できません。もう一度押すと機械の音声で読みます',
        )
      throw speechError
    }
  }
}

/** 単語を読み上げる */
export function playWord(
  packId: string,
  item: { word: string; audio?: AudioRef },
): Promise<void> {
  return playOrSpeak(packId, item.audio, item.word)
}

/** 用法の例文を読み上げる */
export function playExample(
  packId: string,
  sense: Pick<Sense, 'example' | 'exampleAudio'>,
): Promise<void> {
  return playOrSpeak(packId, sense.exampleAudio, sense.example)
}
