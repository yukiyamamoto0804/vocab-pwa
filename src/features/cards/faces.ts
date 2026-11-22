import type { Face, ItemRecord } from '../../db/types'
import { clozeSenseIndexes } from './cloze'

// 表面の種類ごとに必要なデータの判定（docs/specs/study-cards.md 3 章）

/** 作り終えた表面の種類（選択肢に出す順）。例文の音声 → 解説は手順 8 で足す */
export const AVAILABLE_FACES: readonly Face[] = ['en', 'word-audio', 'ja']

/** 初回に選ばれている表面の種類（docs/specs/study-cards.md 7 章） */
export const DEFAULT_FACE: Face = 'en'

export const FACE_LABELS: Record<Face, string> = {
  en: '英語 → 解説',
  ja: '日本語 → 解説',
  'word-audio': '単語の音声 → 解説',
  'example-audio': '例文の音声 → 解説',
}

export function isAvailableFace(face: Face): boolean {
  return AVAILABLE_FACES.includes(face)
}

/** その表面のカードを作れる単語か。必要なデータがない単語は出題しない */
export function hasFaceData(
  item: Pick<ItemRecord, 'audio' | 'word' | 'senses'>,
  face: Face,
): boolean {
  switch (face) {
    case 'en':
      return true
    case 'word-audio':
      return item.audio !== undefined
    // 例文の中に該当語が見つかる用法が 1 つ以上あること
    case 'ja':
      return clozeSenseIndexes(item).length > 0
    // まだ作っていない表面
    case 'example-audio':
      return false
  }
}

/** 表面に必要なデータがなくて出さない単語があるときのお知らせ。なければ undefined */
export function skippedNotice(
  skippedCount: number,
  face: Face,
): string | undefined {
  return skippedCount > 0
    ? `${skippedCount} 語は、${FACE_LABELS[face]}に必要なデータがないため出しません。`
    : undefined
}

/** 対象の単語がすべて、表面に必要なデータがなくて出せないときのお知らせ */
export function noFaceDataMessage(face: Face): string {
  return `選んだ表面（${FACE_LABELS[face]}）で出題できる単語がありません。表面を変えてください。`
}
