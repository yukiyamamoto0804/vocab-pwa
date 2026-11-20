import { getAudioBlob } from '../../db/content'
import type { AudioRef } from '../../db/types'
import { resolveSegment } from './segment'

// 区間を指定して音声を再生する（Web Audio API。docs/RULES.md 9 章）。
// 音声ファイルは 1 ファイルに複数の項目が入っていることがあるため、
// デコード済みのデータを覚えておき、同じファイルの別の区間をすぐ再生できるようにする。

/**
 * デコード済みの音声を覚えておく合計の大きさ（バイト）。
 * デコード後の大きさは「長さ（秒）× サンプリングレート × チャンネル数 × 4 バイト」で、
 * 48kHz・ステレオなら 1 分でおよそ 23 MB になる。スマホのメモリを圧迫しないよう抑える。
 */
const MAX_CACHE_BYTES = 100 * 1024 * 1024

let context: AudioContext | undefined
let current: AudioBufferSourceNode | undefined
/** 最後に押された再生の番号。デコードを待つ間に別の再生が押されたら、古いほうは鳴らさない */
let latestRequest = 0

interface CacheEntry {
  buffer: Promise<AudioBuffer>
  /** デコードが終わるまでは 0 */
  bytes: number
}
const cache = new Map<string, CacheEntry>()

// iOS では、ボタンを押した処理の中で同期的に AudioContext を作る・再開する必要がある。
// 再開の完了を待つ Promise を返す
function prepareContext(): { ctx: AudioContext; ready: Promise<void> } {
  if (!context) {
    // マナーモードでも音が出るように「再生用」の扱いにする（対応している iOS の Safari のみ）。
    // 単語帳では音声が主役なので、ほかのアプリで流している音楽が止まることは受け入れる
    const session = (navigator as { audioSession?: { type: string } })
      .audioSession
    if (session) session.type = 'playback'
    context = new AudioContext()
  }
  // iOS では、着信やバックグラウンドからの復帰の後に 'interrupted' という状態になることがある
  const ready =
    context.state === 'running' ? Promise.resolve() : context.resume()
  return { ctx: context, ready }
}

function cacheKey(packId: string, file: string): string {
  return `${packId}\n${file}`
}

function loadBuffer(
  ctx: AudioContext,
  packId: string,
  file: string,
): Promise<AudioBuffer> {
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

/** 再生中の音声を止める */
export function stopAudio(): void {
  current?.stop()
  current = undefined
}

/**
 * 指定の区間を再生する。再生が終わる（または別の再生で止められる）と完了する。
 * ボタンを押したときの処理から直接呼ぶこと（iOS の自動再生の制限のため）。
 */
export async function playAudio(packId: string, ref: AudioRef): Promise<void> {
  const { ctx, ready } = prepareContext()
  const request = ++latestRequest
  stopAudio()
  const buffer = await loadBuffer(ctx, packId, ref.file)
  await ready
  if (request !== latestRequest) return // 待っている間に、別の再生が押された
  if (ctx.state !== 'running')
    throw new Error('音声を再生できる状態にできませんでした')
  const segment = resolveSegment(ref, buffer.duration)
  if (!segment) throw new Error('再生する区間が音声の長さの外にあります')

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  current = source
  await new Promise<void>((resolve) => {
    // 再生が途中で止まり、終わりの通知が来ない場合でも、ボタンが「再生中」のままにならないようにする
    const timer = setTimeout(resolve, (segment.duration + 1) * 1000)
    source.onended = () => {
      clearTimeout(timer)
      if (current === source) current = undefined
      resolve()
    }
    source.start(0, segment.offset, segment.duration)
  })
}
