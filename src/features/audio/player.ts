import { getAudioBlob } from '../../db/content'
import { type AudioRef, MAX_AUDIO_FILE_BYTES } from '../../db/types'
import { resolveSegment } from './segment'
import { stopSpeech } from './speech'
import { encodeWav } from './wav'

// 区間を指定して音声を再生する（docs/RULES.md 9 章）。
// 音声ファイルは 1 ファイルに複数の項目が入っていることがあるため、
// デコード済みのデータを覚えておき、同じファイルの別の区間をすぐ再生できるようにする。
//
// 鳴らすのは Web Audio API ではなく <audio> 要素で行う。iOS の Safari では、アプリを離れて戻ると
// AudioContext が「再生中」と応答したまま音が出なくなる不具合があるため。
// 停止位置がずれないよう、区間だけを切り出した WAV を作って最後まで鳴らす。

/**
 * デコード済みの音声を覚えておく合計の大きさ（バイト）。
 * デコードした音声はモノラルにまとめて覚えるので、大きさは「長さ（秒）× サンプリングレート × 4 バイト」で、
 * 44.1kHz なら 1 分でおよそ 10 MB になる。スマホのメモリを圧迫しないよう抑える。
 */
const MAX_CACHE_BYTES = 100 * 1024 * 1024

/** 音声ファイルそのものに原因がある失敗（見つからない・大きすぎる・読み解けない）。PlayButton は userMessage を画面に出す */
export class AudioFileError extends Error {
  readonly userMessage: string
  constructor(message: string, userMessage: string) {
    super(message)
    this.userMessage = userMessage
  }
}

/** 教材の音声に問題があるときの、利用者向けの文言 */
const BROKEN_AUDIO_MESSAGE =
  '音声ファイルを再生できません。教材パックの音声を確かめて、取り込み直してください'

/** 端末が再生を止めた失敗（iOS で操作との結び付きが切れた など）。ファイルの問題ではない */
export class PlaybackBlockedError extends Error {
  readonly userMessage = '再生できませんでした。もう一度押してください'
}

/** 区間が音声の長さの外にある失敗 */
export class SegmentError extends Error {}

/** デコードするときのサンプリングレート */
const DECODE_SAMPLE_RATE = 44100

let element: HTMLAudioElement | undefined
/** iOS の自動再生の制限が解けたか（下の prepareElement） */
let unlocked = false
/** 今読み込ませている WAV の URL。次の区間に替えるときに解放する */
let sourceUrl: string | undefined
/** 今の再生を終わらせる（完了を待っている処理に知らせる）関数 */
let finishCurrent: (() => void) | undefined
/** 最後に押された再生の番号。デコードを待つ間に別の再生が押されたら、古いほうは鳴らさない */
let latestRequest = 0

/** デコードしてモノラルにまとめた音声 */
interface Decoded {
  samples: Float32Array
  sampleRate: number
  /** 長さ（秒） */
  duration: number
}

interface CacheEntry {
  decoded: Promise<Decoded>
  /** デコードが終わるまでは 0 */
  bytes: number
}
const cache = new Map<string, CacheEntry>()

/**
 * マナーモードでも音が出るように「再生用」の扱いにする（対応している iOS の Safari のみ）。
 * 単語帳では音声が主役なので、ほかのアプリで流している音楽が止まることは受け入れる。
 * 機械の音声（読み上げ）の前にも呼ぶ
 */
export function setPlaybackSession(): void {
  const session = (navigator as { audioSession?: { type: string } })
    .audioSession
  if (session) session.type = 'playback'
}

// iOS では、ボタンを押した処理の中で一度 play() を呼んだ <audio> 要素だけが、
// その後、デコードを待ってから再生できる。そのため解けるまでは、押されたときに無音を鳴らしておく
function prepareElement(): HTMLAudioElement {
  if (!element) {
    setPlaybackSession()
    element = new Audio()
  }
  if (!unlocked) {
    const silence = new Blob([encodeWav([new Float32Array(1)], 8000)], {
      type: 'audio/wav',
    })
    setSource(element, silence)
    // 続けて区間の再生に替わると中断扱いで失敗するが、許可は得られているので解けたものとする。
    // 許可されなかったとき（NotAllowedError）だけ、次に押されたときに試し直す
    element.play().then(
      () => {
        unlocked = true
      },
      (e: unknown) => {
        if (!(e instanceof DOMException && e.name === 'NotAllowedError'))
          unlocked = true
      },
    )
  }
  return element
}

/**
 * 後でボタンの操作の外から playAudio を呼べるように、iOS の自動再生の制限を解いておく。
 * ボタンを押したときの処理から直接呼ぶこと（自動で進める学習の「開始」など。study-cards.md 11 章）
 */
export function unlockAudio(): void {
  prepareElement()
}

function setSource(audio: HTMLAudioElement, wav: Blob): void {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl)
  sourceUrl = URL.createObjectURL(wav)
  audio.src = sourceUrl
}

function cacheKey(packId: string, file: string): string {
  return `${packId}\n${file}`
}

/** すべてのチャンネルを平均して、モノラルの 1 本にまとめる（覚えておく量を減らすため。再生もモノラル） */
export function toMono(
  buffer: Pick<AudioBuffer, 'numberOfChannels' | 'length' | 'getChannelData'>,
): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const mono = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i]
  }
  for (let i = 0; i < mono.length; i += 1) mono[i] /= buffer.numberOfChannels
  return mono
}

function loadDecoded(packId: string, file: string): Promise<Decoded> {
  const key = cacheKey(packId, file)
  const cached = cache.get(key)
  if (cached) {
    // 最近使ったものとして末尾に移す
    cache.delete(key)
    cache.set(key, cached)
    return cached.decoded
  }
  const entry: CacheEntry = {
    decoded: (async () => {
      const blob = await getAudioBlob(packId, file)
      if (!blob)
        throw new AudioFileError(
          `音声ファイル ${file} が見つかりません`,
          BROKEN_AUDIO_MESSAGE,
        )
      // 取り込みでも確かめているが、古い版で取り込んだ教材のために再生の前にも確かめる（メモリ不足で落ちないように）
      if (blob.size > MAX_AUDIO_FILE_BYTES)
        throw new AudioFileError(
          `音声ファイル ${file} が大きすぎます`,
          `音声ファイルが大きすぎて再生できません（1 ファイル ${MAX_AUDIO_FILE_BYTES / 1024 / 1024} MB まで）。教材パックを作り直して取り込み直してください`,
        )
      let buffer: AudioBuffer
      try {
        // デコードだけなので、音を出さない OfflineAudioContext を使う
        const ctx = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE)
        buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
      } catch (e) {
        throw new AudioFileError(
          `音声ファイル ${file} を読み解けません（${String(e)}）`,
          BROKEN_AUDIO_MESSAGE,
        )
      }
      return {
        samples: toMono(buffer),
        sampleRate: buffer.sampleRate,
        duration: buffer.duration,
      }
    })(),
    bytes: 0,
  }
  cache.set(key, entry)
  entry.decoded.then(
    (decoded) => {
      entry.bytes = decoded.samples.length * 4
      // 1 つで上限を超えるものは覚えておかない
      if (entry.bytes > MAX_CACHE_BYTES) {
        if (cache.get(key) === entry) cache.delete(key)
        return
      }
      evict(key)
    },
    // 失敗したものは覚えておかない（取り込み直しなどで、同じキーの新しいものに替わっていたら消さない）
    () => {
      if (cache.get(key) === entry) cache.delete(key)
    },
  )
  return entry.decoded
}

// 合計が上限を超えたら、古いものから捨てる。今使うもの（keep）と、デコード中のものは残す
function evict(keep: string): void {
  let total = 0
  for (const entry of cache.values()) total += entry.bytes
  for (const [key, entry] of cache) {
    if (total <= MAX_CACHE_BYTES) break
    if (key === keep || entry.bytes === 0) continue
    cache.delete(key)
    total -= entry.bytes
  }
}

/** デコード済みの音声を全て捨てる。教材パックを取り込み直した後に呼ぶ */
export function clearAudioCache(): void {
  cache.clear()
}

/** 再生中の音声（機械の音声の読み上げも）を止める。デコードを待っている再生も鳴らさない */
export function stopAudio(): void {
  latestRequest += 1
  element?.pause()
  finishCurrent?.()
  stopSpeech()
}

// 区間だけを切り出した WAV にして、<audio> 要素に読み込ませる
function setClip(
  audio: HTMLAudioElement,
  decoded: Decoded,
  offset: number,
  duration: number,
): void {
  const from = Math.round(offset * decoded.sampleRate)
  const to = Math.round((offset + duration) * decoded.sampleRate)
  if (to <= from) throw new SegmentError('再生する区間が短すぎます')
  const wav = new Blob(
    [encodeWav([decoded.samples.subarray(from, to)], decoded.sampleRate)],
    { type: 'audio/wav' },
  )
  setSource(audio, wav)
}

/**
 * 指定の区間を再生する。再生が終わる（または別の再生で止められる）と完了する。
 * ボタンを押したときの処理から直接呼ぶこと（iOS の自動再生の制限のため）。
 */
export async function playAudio(packId: string, ref: AudioRef): Promise<void> {
  const audio = prepareElement()
  stopAudio()
  const request = latestRequest
  let decoded: Decoded
  try {
    decoded = await loadDecoded(packId, ref.file)
  } catch (e) {
    // 待っている間に止められた・別の再生が押されたなら、失敗も知らせない（機械の音声で読み直させない）
    if (request !== latestRequest) return
    throw e
  }
  if (request !== latestRequest) return // 待っている間に、別の再生が押された
  const segment = resolveSegment(ref, decoded.duration)
  if (!segment) throw new SegmentError('再生する区間が音声の長さの外にあります')

  setClip(audio, decoded, segment.offset, segment.duration)
  await playLoaded(audio, segment.duration)
}

/** 読み込んだ音声を再生し、終わる（または別の再生で止められる）と完了する */
function playLoaded(audio: HTMLAudioElement, duration: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      if (finishCurrent !== finish) return // すでに終わっている
      finishCurrent = undefined
      clearTimeout(timer)
      audio.onended = null
      if (error === undefined) resolve()
      else reject(error)
    }
    // 再生が途中で止まり、終わりの通知が来ない場合でも、ボタンが「再生中」のままにならないようにする。
    // 鳴り始めるまでの遅れも見込んで、区間の長さより長めに待つ
    const timer = setTimeout(
      () => {
        audio.pause()
        finish()
      },
      (duration + 3) * 1000,
    )
    finishCurrent = finish
    audio.onended = () => finish()
    audio.play().catch((e: unknown) => {
      // 端末が再生を止めたときは、ファイルの問題ではないことが分かる失敗にする
      finish(
        e instanceof DOMException &&
          (e.name === 'NotAllowedError' || e.name === 'AbortError')
          ? new PlaybackBlockedError(e.message)
          : e,
      )
    })
  })
}
