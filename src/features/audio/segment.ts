import type { AudioRef } from '../../db/types'

export interface Segment {
  /** 再生を始める位置（秒） */
  offset: number
  /** 再生する長さ（秒） */
  duration: number
}

// 音声の指定（開始秒〜終了秒、省略時はファイル全体）を、実際の長さに収まる再生区間にする。
// 区間がファイルの長さの外にあれば null。
export function resolveSegment(
  ref: AudioRef,
  fileDuration: number,
): Segment | null {
  const start = ref.start ?? 0
  const end = Math.min(ref.end ?? fileDuration, fileDuration)
  if (start >= end) return null
  return { offset: start, duration: end - start }
}
