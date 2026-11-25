import type { FrontSenseChoice } from '../../db/settings'
import type { Face, ItemRecord } from '../../db/types'
import type { Random } from '../../lib/random'
import { clozeSenseIndexes } from './cloze'

// 表面の種類ごとに必要なデータの判定（docs/specs/study-cards.md 3 章）

/** 初回に選ばれている表面の種類（docs/specs/study-cards.md 7 章） */
export const DEFAULT_FACE: Face = 'en'

export const FACE_LABELS: Record<Face, string> = {
  en: '英単語',
  ja: '例文の訳',
  'word-audio': '単語の音声',
  'example-audio': '例文の音声',
  'word-audio-auto': '単語の音声（自動）',
}

/** 表面に出すもの（表面の種類のうち、進め方の違いを除いたもの） */
export type FrontContent = Exclude<Face, 'word-audio-auto'>

/**
 * 表面に何を出すか。自動で進める学習は、「単語の音声」と同じものを出す（study-cards.md 11 章）。
 * 表面に出すものと必要なデータの判定は、これを通して行う
 */
export function frontContentOf(face: Face): FrontContent {
  return face === 'word-audio-auto' ? 'word-audio' : face
}

/** 自動で進める学習か（study-cards.md 11 章） */
export function isAutoAdvanceFace(face: Face): boolean {
  return face === 'word-audio-auto'
}

/** 音声の表面か */
export function isAudioFace(face: Face): boolean {
  const content = frontContentOf(face)
  return content === 'word-audio' || content === 'example-audio'
}

/** その表面のカードを作れる単語か。必要なデータがない単語は出題しない */
export function hasFaceData(
  item: Pick<ItemRecord, 'word' | 'senses' | 'audio'>,
  face: Face,
): boolean {
  switch (frontContentOf(face)) {
    case 'en':
      return true
    // 音声の表面は、音声ファイルがある単語・用法だけ。機械の音声は聞き取りの練習に向かないため使わない（study-cards.md 3 章）
    case 'word-audio':
      return item.audio !== undefined
    case 'example-audio':
      return item.senses.some((s) => s.exampleAudio !== undefined)
    // 例文の中に該当語が見つかる用法が 1 つ以上あること
    case 'ja':
      return clozeSenseIndexes(item).length > 0
  }
}

/**
 * 表面に例文を使う種類で、表面に使う用法を選ぶ（学習を始めるときに単語ごとに 1 回）。
 * 「例文の訳」は例文に該当語が見つかる用法から、「例文の音声」は例文の音声がある用法から選ぶ。
 * 選び方（設定）が first ならいちばん前のもの、random ならランダムに選ぶ（study-cards.md 4 章）
 */
export function pickFrontSense(
  item: Pick<ItemRecord, 'word' | 'senses'>,
  face: 'ja' | 'example-audio',
  choice: FrontSenseChoice,
  random: Random = Math.random,
): number {
  const candidates = frontSenseCandidates(item, face)
  if (choice === 'first') return candidates[0] ?? 0
  return candidates[Math.floor(random() * candidates.length)] ?? 0
}

/** 表面に使える用法の位置（「例文の訳」は例文に該当語が見つかるもの、「例文の音声」は例文の音声があるもの） */
export function frontSenseCandidates(
  item: Pick<ItemRecord, 'word' | 'senses'>,
  face: 'ja' | 'example-audio',
): number[] {
  if (face === 'ja') return clozeSenseIndexes(item)
  return item.senses.flatMap((s, i) =>
    s.exampleAudio !== undefined ? [i] : [],
  )
}

/** 出さない理由。表面の名前は「」で囲み、文と切り分ける（例: 「単語の音声（自動）」に使う音声がない） */
function skipReason(face: Face): string {
  return isAudioFace(face)
    ? `「${FACE_LABELS[face]}」に使う音声がない`
    : `「${FACE_LABELS[face]}」に必要なデータがない`
}

/** 表面に必要なデータがなくて出さない単語があるときのお知らせ。なければ undefined */
export function skippedNotice(
  skippedCount: number,
  face: Face,
): string | undefined {
  return skippedCount > 0
    ? `${skippedCount} 語は、${skipReason(face)}ため出しません。`
    : undefined
}

/** 対象の単語がすべて、表面に必要なデータがなくて出せないときのお知らせ */
export function noFaceDataMessage(face: Face): string {
  return isAudioFace(face)
    ? `選んだ表面「${FACE_LABELS[face]}」で出題できる単語がありません。音声のある単語がないためです。表面を変えてください。`
    : `選んだ表面「${FACE_LABELS[face]}」で出題できる単語がありません。表面を変えてください。`
}
