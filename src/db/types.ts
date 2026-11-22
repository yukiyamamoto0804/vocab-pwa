// 端末内に保存するデータの型。用語は docs/ARCHITECTURE.md 2 章、
// 教材パックの形式は docs/CONTENT_FORMAT.md に従う。

// ---- 用語 ----

/** 表面の種類 */
export const FACES = ['en', 'ja', 'word-audio', 'example-audio'] as const
export type Face = (typeof FACES)[number]

/** 自己申告 */
export type Rating = 'remembered' | 'unsure' | 'forgot'

/** ユニット学習 / テスト / 復習 */
export type StudyMode = 'unit' | 'test' | 'review'

/** テストの並び順（苦手優先 / ランダム） */
export type TestOrder = 'weak' | 'random'

// ---- 教材パックの中身（manifest.json / items.json） ----

/** 品詞の一覧（docs/CONTENT_FORMAT.md） */
export const PARTS_OF_SPEECH = [
  '名詞',
  '代名詞',
  '自動詞',
  '他動詞',
  '助動詞',
  '形容詞',
  '副詞',
  '前置詞',
  '接続詞',
  '間投詞',
  '句動詞',
  'その他',
] as const
export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]

export interface AudioRef {
  file: string
  start?: number
  end?: number
}

export interface Meaning {
  pos: PartOfSpeech
  meaning: string
}

export interface Sense {
  meanings: Meaning[]
  example: string
  exampleTarget?: string
  exampleTranslation: string
  /** 例文の訳の中で、該当語にあたる部分（日本語 → 解説で太字にする） */
  exampleTranslationTarget?: string
  exampleAudio?: AudioRef
}

export interface Idiom {
  phrase: string
  meaning: string
}

export interface ContentItem {
  id: string
  word: string
  unit?: number
  audio?: AudioRef
  senses: Sense[]
  idioms?: Idiom[]
}

export interface ManifestUnit {
  id: number
  title?: string
}

export interface Manifest {
  formatVersion: number
  id: string
  title: string
  createdAt?: string
  units?: ManifestUnit[]
}

// ---- 教材のテーブル ----

export interface PackRecord {
  id: string
  manifest: Manifest
  /** 最初に取り込んだ日時（エポックミリ秒）。取り込み直しても変えない（一覧の並びを保つため） */
  importedAt: number
}

export interface UnitRecord {
  packId: string
  id: number
  title?: string
}

export interface ItemRecord extends Omit<ContentItem, 'unit'> {
  packId: string
  /** 所属ユニット番号（自動で区切った場合も入る） */
  unit: number
  /** パック内の並び順（0 始まり） */
  order: number
}

export interface AudioFileRecord {
  packId: string
  file: string
  blob: Blob
}

// ---- 学習記録のテーブル ----
// 日時はすべてエポックミリ秒で持つ（エクスポートしやすいため）。

export interface ProgressRecord {
  packId: string
  itemId: string
  /** 定着度（0〜1） */
  mastery: number
  /** いずれかの表面で最後に出題された日時 */
  lastReviewedAt: number
  /** 表面の種類ごとの最終出題日時 */
  lastReviewedAtByFace: Partial<Record<Face, number>>
}

/**
 * 学習 1 回分の回答の記録（docs/ARCHITECTURE.md 4 章）。
 * 容量を抑えるため、回答ごとの値は回答した順の配列で持つ。
 */
export interface StudySessionRecord {
  /** randomId()（src/lib/random.ts） */
  id: string
  packId: string
  startedAt: number
  mode: StudyMode
  face: Face
  itemIds: string[]
  /** 各回答が学習開始から何秒後か（整数） */
  seconds: number[]
  /** 各回答の自己申告を RATING_CODES の 1 文字ずつ並べた文字列 */
  ratings: string
}

/** studySessions.ratings で自己申告を表す 1 文字 */
export const RATING_CODES = {
  remembered: 'r',
  unsure: 'u',
  forgot: 'f',
} as const satisfies Record<Rating, string>

export interface ReportRecord {
  /** randomId()（src/lib/random.ts） */
  id: string
  at: number
  packId: string
  itemId: string
}

export interface SettingRecord {
  key: string
  value: unknown
}

/**
 * 音声ファイル 1 つの大きさの上限（バイト）。区間を鳴らすときはファイル全体を読み解くので、
 * 長いファイルだとスマホのメモリが足りなくなるため。取り込みと再生の両方で使う（docs/CONTENT_FORMAT.md）
 */
export const MAX_AUDIO_FILE_BYTES = 5 * 1024 * 1024
