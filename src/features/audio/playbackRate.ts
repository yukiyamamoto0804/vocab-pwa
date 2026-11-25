import {
  getPlaybackRate,
  type PlaybackRate,
  savePlaybackRate,
} from '../../db/settings'

// 音声を流す速さ（docs/specs/study-cards.md 9 章）。保存先は settings。
// iOS では読み上げを押した操作の中で（同期で）始める必要があるため、鳴らすときに DB を待たないよう、今の値を覚えておく

let current: PlaybackRate = 1
/** 最後に保存できた（または読み込んだ）値。保存に失敗したらここに戻す */
let saved: PlaybackRate = 1
/** 値を変えた回数。読み込みを待つ間に選び直されたら、読み込んだ古い値で上書きしない */
let changeCount = 0

/** 今の速さ。再生と読み上げで使う */
export function currentPlaybackRate(): PlaybackRate {
  return current
}

/** 保存した速さを読み込んで、今の値にする。起動時と、学習記録を置き換えた後に呼ぶ */
export async function loadPlaybackRate(): Promise<PlaybackRate> {
  const count = changeCount
  const rate = await getPlaybackRate()
  if (count === changeCount) {
    current = rate
    saved = rate
  }
  return current
}

/**
 * 速さを変えて保存する。保存に失敗したら、最後に保存できた値に戻して失敗を返す。
 * 待つ間に選び直されていたら、古い保存の結果は扱わない（失敗も返さない）
 */
export async function changePlaybackRate(rate: PlaybackRate): Promise<void> {
  current = rate
  changeCount += 1
  const count = changeCount
  try {
    await savePlaybackRate(rate)
    saved = rate
  } catch (e) {
    if (count !== changeCount) return
    current = saved
    throw e
  }
}
