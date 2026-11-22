import {
  type AudioRef,
  type ContentItem,
  type Idiom,
  MAX_AUDIO_FILE_BYTES,
  type Manifest,
  type ManifestUnit,
  type Meaning,
  PARTS_OF_SPEECH,
  type Sense,
} from '../../db/types'
import type { PackError } from './packError'

// manifest.json と items.json の中身を検証する（docs/CONTENT_FORMAT.md「取り込み時の検証」）。
// 外から来たデータなので、知っている項目だけを取り出して新しいオブジェクトを作る。

export type ValidateResult =
  | { ok: true; manifest: Manifest; items: ContentItem[] }
  | { ok: false; errors: PackError[] }

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== ''

/** id として使える文字列か。前後に空白があると、見た目が同じ別の id になり学習記録が引き継がれないので許さない */
const checkId = (v: unknown): string | undefined =>
  !isNonEmptyString(v)
    ? '空でない文字列が必要です'
    : v !== v.trim()
      ? '前後に空白を入れないでください'
      : undefined

const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1

const isPartOfSpeech = (v: unknown): v is Meaning['pos'] =>
  PARTS_OF_SPEECH.some((p) => p === v)

export function validatePack(
  manifestRaw: unknown,
  itemsRaw: unknown,
  audioFiles: ReadonlyMap<string, number>,
): ValidateResult {
  const errors: PackError[] = []
  const add = (where: string, message: string) =>
    errors.push({ where, message })

  const manifest = validateManifest(manifestRaw, add)
  const items = validateItems(itemsRaw, audioFiles, add)

  if (manifest && items) checkUnits(manifest, items, add)

  if (errors.length > 0 || !manifest || !items) return { ok: false, errors }
  return { ok: true, manifest, items }
}

type Add = (where: string, message: string) => void

function validateManifest(raw: unknown, add: Add): Manifest | null {
  const at = (field: string) => `manifest.json の ${field}`
  if (!isObj(raw)) {
    add('manifest.json', 'オブジェクトではありません')
    return null
  }
  let ok = true
  if (raw.formatVersion !== 1) {
    add(at('formatVersion'), '対応している形式のバージョンは 1 だけです')
    ok = false
  }
  const idError = checkId(raw.id)
  if (idError) {
    add(at('id'), idError)
    ok = false
  }
  if (!isNonEmptyString(raw.title)) {
    add(at('title'), '空でない文字列が必要です')
    ok = false
  }
  for (const field of ['createdAt', 'license', 'attribution'] as const) {
    if (raw[field] !== undefined && typeof raw[field] !== 'string') {
      add(at(field), '文字列が必要です')
      ok = false
    }
  }

  let units: ManifestUnit[] | undefined
  if (raw.units !== undefined) {
    if (!Array.isArray(raw.units)) {
      add(at('units'), '配列が必要です')
      ok = false
    } else {
      const list: ManifestUnit[] = []
      units = list
      const seen = new Set<number>()
      raw.units.forEach((u: unknown, i) => {
        const where = at(`units[${i}]`)
        if (!isObj(u) || !isPositiveInt(u.id)) {
          add(`${where}.id`, '1 以上の整数が必要です')
          ok = false
          return
        }
        if (seen.has(u.id)) {
          add(`${where}.id`, `ユニット番号 ${u.id} が重複しています`)
          ok = false
          return
        }
        seen.add(u.id)
        if (u.title !== undefined && typeof u.title !== 'string') {
          add(`${where}.title`, '文字列が必要です')
          ok = false
          return
        }
        list.push(
          u.title === undefined ? { id: u.id } : { id: u.id, title: u.title },
        )
      })
    }
  }

  if (!ok) return null
  const manifest: Manifest = {
    formatVersion: 1,
    id: raw.id as string,
    title: raw.title as string,
  }
  if (typeof raw.createdAt === 'string') manifest.createdAt = raw.createdAt
  if (typeof raw.license === 'string') manifest.license = raw.license
  if (typeof raw.attribution === 'string')
    manifest.attribution = raw.attribution
  if (units) manifest.units = units
  return manifest
}

function itemLabel(index: number, id?: string): string {
  const base = `items.json の ${index + 1} 番目`
  return id === undefined ? base : `${base}（id: ${id}）`
}

function validateItems(
  raw: unknown,
  audioFiles: ReadonlyMap<string, number>,
  add: Add,
): ContentItem[] | null {
  if (!Array.isArray(raw)) {
    add('items.json', '配列ではありません')
    return null
  }
  if (raw.length === 0) {
    add('items.json', '単語が 1 つもありません')
    return null
  }

  const items: ContentItem[] = []
  const seenIds = new Set<string>()
  let ok = true
  raw.forEach((itemRaw: unknown, i) => {
    const label = itemLabel(
      i,
      isObj(itemRaw) && typeof itemRaw.id === 'string' ? itemRaw.id : undefined,
    )
    const item = validateItem(itemRaw, label, audioFiles, add)
    if (!item) {
      ok = false
      return
    }
    if (seenIds.has(item.id)) {
      add(`${label}の id`, 'ほかの単語と id が重複しています')
      ok = false
      return
    }
    seenIds.add(item.id)
    items.push(item)
  })
  return ok ? items : null
}

function validateItem(
  raw: unknown,
  label: string,
  audioFiles: ReadonlyMap<string, number>,
  add: Add,
): ContentItem | null {
  const at = (field: string) => `${label}の ${field}`
  if (!isObj(raw)) {
    add(label, 'オブジェクトではありません')
    return null
  }
  const errorCount = { n: 0 }
  const fail: Add = (where, message) => {
    errorCount.n += 1
    add(where, message)
  }

  const idError = checkId(raw.id)
  if (idError) fail(at('id'), idError)
  if (!isNonEmptyString(raw.word)) fail(at('word'), '空でない文字列が必要です')
  if (raw.unit !== undefined && !isPositiveInt(raw.unit))
    fail(at('unit'), '1 以上の整数が必要です')

  const audio =
    raw.audio === undefined
      ? undefined
      : validateAudio(raw.audio, at('audio'), audioFiles, fail)

  const senses: Sense[] = []
  if (!Array.isArray(raw.senses) || raw.senses.length === 0) {
    fail(at('senses'), '1 つ以上の用法が必要です')
  } else {
    raw.senses.forEach((s: unknown, i) => {
      const sense = validateSense(s, at(`senses[${i}]`), audioFiles, fail)
      if (sense) senses.push(sense)
    })
  }

  const idioms: Idiom[] = []
  if (raw.idioms !== undefined) {
    if (!Array.isArray(raw.idioms)) {
      fail(at('idioms'), '配列が必要です')
    } else {
      raw.idioms.forEach((d: unknown, i) => {
        const where = at(`idioms[${i}]`)
        if (
          !isObj(d) ||
          !isNonEmptyString(d.phrase) ||
          !isNonEmptyString(d.meaning)
        ) {
          fail(where, 'phrase と meaning（空でない文字列）が必要です')
          return
        }
        idioms.push({ phrase: d.phrase, meaning: d.meaning })
      })
    }
  }

  if (errorCount.n > 0) return null
  const item: ContentItem = {
    id: raw.id as string,
    word: raw.word as string,
    senses,
  }
  if (raw.unit !== undefined) item.unit = raw.unit as number
  if (audio) item.audio = audio
  if (raw.idioms !== undefined) item.idioms = idioms
  return item
}

function validateSense(
  raw: unknown,
  where: string,
  audioFiles: ReadonlyMap<string, number>,
  fail: Add,
): Sense | null {
  const at = (field: string) => `${where}.${field}`
  if (!isObj(raw)) {
    fail(where, 'オブジェクトではありません')
    return null
  }
  let ok = true
  const meanings: Meaning[] = []
  if (!Array.isArray(raw.meanings) || raw.meanings.length === 0) {
    fail(at('meanings'), '1 つ以上の品詞と訳が必要です')
    ok = false
  } else {
    raw.meanings.forEach((m: unknown, i) => {
      const mw = at(`meanings[${i}]`)
      if (!isObj(m)) {
        fail(mw, 'オブジェクトではありません')
        ok = false
        return
      }
      if (!isPartOfSpeech(m.pos)) {
        fail(`${mw}.pos`, '品詞の一覧にない値です')
        ok = false
      }
      if (!isNonEmptyString(m.meaning)) {
        fail(`${mw}.meaning`, '空でない文字列が必要です')
        ok = false
      }
      if (isPartOfSpeech(m.pos) && isNonEmptyString(m.meaning))
        meanings.push({ pos: m.pos, meaning: m.meaning })
    })
  }
  if (!isNonEmptyString(raw.example)) {
    fail(at('example'), '空でない文字列が必要です')
    ok = false
  }
  if (!isNonEmptyString(raw.exampleTranslation)) {
    fail(at('exampleTranslation'), '空でない文字列が必要です')
    ok = false
  }
  if (raw.exampleTarget !== undefined && !isNonEmptyString(raw.exampleTarget)) {
    fail(at('exampleTarget'), '空でない文字列が必要です')
    ok = false
  }
  if (
    raw.exampleTranslationTarget !== undefined &&
    !isNonEmptyString(raw.exampleTranslationTarget)
  ) {
    fail(at('exampleTranslationTarget'), '空でない文字列が必要です')
    ok = false
  }
  const exampleAudio =
    raw.exampleAudio === undefined
      ? undefined
      : validateAudio(raw.exampleAudio, at('exampleAudio'), audioFiles, fail)
  if (raw.exampleAudio !== undefined && !exampleAudio) ok = false

  if (!ok) return null
  const sense: Sense = {
    meanings,
    example: raw.example as string,
    exampleTranslation: raw.exampleTranslation as string,
  }
  if (raw.exampleTarget !== undefined)
    sense.exampleTarget = raw.exampleTarget as string
  if (raw.exampleTranslationTarget !== undefined)
    sense.exampleTranslationTarget = raw.exampleTranslationTarget as string
  if (exampleAudio) sense.exampleAudio = exampleAudio
  return sense
}

function validateAudio(
  raw: unknown,
  where: string,
  audioFiles: ReadonlyMap<string, number>,
  fail: Add,
): AudioRef | undefined {
  if (!isObj(raw) || !isNonEmptyString(raw.file)) {
    fail(`${where}.file`, '空でない文字列が必要です')
    return undefined
  }
  let ok = true
  const size = audioFiles.get(raw.file)
  if (size === undefined) {
    fail(`${where}.file`, `audio/ に ${raw.file} がありません`)
    ok = false
  } else if (size === 0) {
    fail(
      `${where}.file`,
      `audio/ の ${raw.file} が空です（zip が壊れている可能性があります）`,
    )
    ok = false
  } else if (size > MAX_AUDIO_FILE_BYTES) {
    fail(
      `${where}.file`,
      `audio/ の ${raw.file} が大きすぎます（1 ファイル ${MAX_AUDIO_FILE_BYTES / 1024 / 1024} MB まで）`,
    )
    ok = false
  }
  for (const key of ['start', 'end'] as const) {
    const v = raw[key]
    if (
      v !== undefined &&
      !(typeof v === 'number' && Number.isFinite(v) && v >= 0)
    ) {
      fail(`${where}.${key}`, '0 以上の数が必要です')
      ok = false
    }
  }
  if (
    typeof raw.start === 'number' &&
    typeof raw.end === 'number' &&
    raw.start >= raw.end
  ) {
    fail(where, 'start は end より小さくする必要があります')
    ok = false
  }
  if (!ok) return undefined
  const audio: AudioRef = { file: raw.file }
  if (typeof raw.start === 'number') audio.start = raw.start
  if (typeof raw.end === 'number') audio.end = raw.end
  return audio
}

// ユニットの指定は「全ての単語に指定する」か「どの単語にも指定しない」のどちらか
function checkUnits(manifest: Manifest, items: ContentItem[], add: Add) {
  const withUnit = items.filter((item) => item.unit !== undefined)
  if (withUnit.length === 0) {
    if (manifest.units)
      add(
        'manifest.json の units',
        'units があるのに、単語に unit が指定されていません',
      )
    return
  }
  if (withUnit.length !== items.length) {
    const i = items.findIndex((item) => item.unit === undefined)
    add(
      `${itemLabel(i, items[i].id)}の unit`,
      'unit は全ての単語に指定するか、どの単語にも指定しないでください',
    )
    return
  }
  const unitIds = new Set(manifest.units?.map((u) => u.id))
  items.forEach(({ id, unit }, i) => {
    if (unit !== undefined && !unitIds.has(unit))
      add(
        `${itemLabel(i, id)}の unit`,
        `manifest.json の units にユニット ${unit} がありません`,
      )
  })
}
