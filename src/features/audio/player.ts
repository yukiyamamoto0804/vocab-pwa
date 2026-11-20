import { getAudioBlob } from '../../db/content'
import type { AudioRef } from '../../db/types'
import { resolveSegment } from './segment'
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
 * デコード後の大きさは「長さ（秒）× サンプリングレート × チャンネル数 × 4 バイト」で、
 * 44.1kHz・ステレオなら 1 分でおよそ 21 MB になる。スマホのメモリを圧迫しないよう抑える。
 */
const MAX_CACHE_BYTES = 100 * 1024 * 1024

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

interface CacheEntry {
  buffer: Promise<AudioBuffer>
  /** デコードが終わるまでは 0 */
  bytes: number
}
const cache = new Map<string, CacheEntry>()

// iOS では、ボタンを押した処理の中で一度 play() を呼んだ <audio> 要素だけが、
// その後、デコードを待ってから再生できる。そのため解けるまでは、押されたときに無音を鳴らしておく
function prepareElement(): HTMLAudioElement {
  if (!element) {
    // マナーモードでも音が出るように「再生用」の扱いにする（対応している iOS の Safari のみ）。
    // 単語帳では音声が主役なので、ほかのアプリで流している音楽が止まることは受け入れる
    const session = (navigator as { audioSession?: { type: string } })
      .audioSession
    if (session) session.type = 'playback'
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

function setSource(audio: HTMLAudioElement, wav: Blob): void {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl)
  sourceUrl = URL.createObjectURL(wav)
  audio.src = sourceUrl
}

function cacheKey(packId: string, file: string): string {
  return `${packId}\n${file}`
}

function loadBuffer(packId: string, file: string): Promise<AudioBuffer> {
  const key = cacheKey(packId, file)
  const cached = cache.get(key)
  if (cached) {
    // 最近使ったものとして末尾に移す
    cache.delete(key)
    cache.set(key, cached)
    return cached.buffer
  }
  const entry: CacheEntry = {
    buffer: (async () => {
      const blob = await getAudioBlob(packId, file)
      if (!blob) throw new Error(`音声ファイル ${file} が見つかりません`)
      // デコードだけなので、音を出さない OfflineAudioContext を使う
      const ctx = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE)
      return ctx.decodeAudioData(await blob.arrayBuffer())
    })(),
    bytes: 0,
  }
  cache.set(key, entry)
  entry.buffer.then(
    (buffer) => {
      entry.bytes = buffer.length * buffer.numberOfChannels * 4
      evict(key)
    },
    // 失敗したものは覚えておかない
    () => cache.delete(key),
  )
  return entry.buffer
}

// 合計が上限を超えたら、古いものから捨てる。今使うもの（keep）は残す
function evict(keep: string): void {
  let total = 0
  for (const entry of cache.values()) total += entry.bytes
  for (const [key, entry] of cache) {
    if (total <= MAX_CACHE_BYTES) break
    if (key === keep) continue
    cache.delete(key)
    total -= entry.bytes
  }
}

/** デコード済みの音声を全て捨てる。教材パックを取り込み直した後に呼ぶ */
export function clearAudioCache(): void {
  cache.clear()
}

/** 再生中の音声を止める。デコードを待っている再生も鳴らさない */
export function stopAudio(): void {
  latestRequest += 1
  element?.pause()
  finishCurrent?.()
}

// 区間だけを切り出した WAV にして、<audio> 要素に読み込ませる
function setClip(
  audio: HTMLAudioElement,
  buffer: AudioBuffer,
  offset: number,
  duration: number,
): void {
  const from = Math.round(offset * buffer.sampleRate)
  const to = Math.round((offset + duration) * buffer.sampleRate)
  if (to <= from) throw new Error('再生する区間が短すぎます')
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) =>
    buffer.getChannelData(c).subarray(from, to),
  )
  const wav = new Blob([encodeWav(channels, buffer.sampleRate)], {
    type: 'audio/wav',
  })
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
  const buffer = await loadBuffer(packId, ref.file)
  if (request !== latestRequest) return // 待っている間に、別の再生が押された
  const segment = resolveSegment(ref, buffer.duration)
  if (!segment) throw new Error('再生する区間が音声の長さの外にあります')

  setClip(audio, buffer, segment.offset, segment.duration)
  await new Promise<void>((resolve, reject) => {
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
      (segment.duration + 3) * 1000,
    )
    finishCurrent = finish
    audio.onended = () => finish()
    audio.play().catch(finish)
  })
}
