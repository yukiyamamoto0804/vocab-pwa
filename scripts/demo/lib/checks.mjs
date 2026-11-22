// デモ教材の中身を確かめる処理（docs/specs/demo-pack.md 3 章）。どれもエラーの文の配列を返す
import { candidatesFor, idiomHeadsFor } from './ejdict.mjs'

export const PACK_ID = 'demo-ngsl'
export const FIRST_RANK = 1001
export const WORD_COUNT = 40
export const UNIT_SIZE = 20
export const UNIT_TITLES = ['デモ 1', 'デモ 2']
export const LICENSE = 'CC BY-SA 4.0'

/**
 * 活用する語尾（長いものから当てる）。動詞・形容詞・形容動詞
 * 例: 買う → 買っ・た、適切な → 適切・に
 */
const ENDINGS = [
  'する',
  'う',
  'く',
  'ぐ',
  'す',
  'つ',
  'ぬ',
  'ぶ',
  'む',
  'る',
  'い',
  'な',
  'だ',
]
const HIRAGANA_ONLY = /^[ぁ-ゟ]*$/
const KANJI_OR_KATAKANA = /[゠-ヿ㐀-鿿豈-﫿]/

/** 太字が、訳語の活用した形か（3 章「確かめること」） */
export function isInflectionOf(target, meaning) {
  if (target === meaning) return true
  const ending = ENDINGS.find(
    (e) => meaning.endsWith(e) && meaning.length > e.length,
  )
  if (!ending) return false
  const stem = meaning.slice(0, -ending.length)
  const usable =
    KANJI_OR_KATAKANA.test(stem) ||
    (HIRAGANA_ONLY.test(stem) && stem.length >= 2)
  if (!usable) return false
  const rest = target.slice(stem.length)
  // 語幹だけ（「買う」→「買」）は、名詞にもなる「する」「な」「だ」の語幹のときだけ認める
  if (!rest && !['する', 'な', 'だ'].includes(ending)) return false
  return target.startsWith(stem) && HIRAGANA_ONLY.test(rest)
}

/** 飛ばした順位を除いて、FIRST_RANK から WORD_COUNT 語の順位。NGSL にない順位に当たったら止める */
export function expectedRanks(ranks, skipped = []) {
  const expected = []
  for (let rank = FIRST_RANK; expected.length < WORD_COUNT; rank += 1) {
    if (!ranks.has(rank)) throw new Error(`NGSL に順位 ${rank} の語がない`)
    if (!skipped.includes(rank)) expected.push(rank)
  }
  return expected
}

const isText = (v) => typeof v === 'string' && v.trim() !== ''

/**
 * JSON の形（ほかの確かめの前に行う。形が違うと、ほかの確かめが黙って飛ばされたり、理由の分からない失敗になったりするため）
 */
export function checkShape(items, manifest, sources) {
  const errors = []
  if (typeof manifest !== 'object' || manifest === null)
    errors.push('manifest.json がオブジェクトではない')
  if (!Array.isArray(sources?.files))
    errors.push('audio-sources.json の files が配列ではない')
  else
    sources.files.forEach((f, i) => {
      if (!isText(f?.file) || !Array.isArray(f?.entries))
        errors.push(
          `audio-sources.json の files[${i}] に file か entries がない`,
        )
    })
  if (!Array.isArray(items)) {
    errors.push('items.json が配列ではない')
    return errors
  }
  items.forEach((item, i) => {
    const label = `items.json の ${i + 1} 番目`
    if (!isText(item?.id) || !isText(item?.word)) {
      errors.push(`${label}: id か word がない`)
      return
    }
    if (!Array.isArray(item.senses) || item.senses.length === 0)
      errors.push(`${label}: senses が 1 つ以上の配列ではない`)
    else
      item.senses.forEach((sense, n) => {
        const where = `${label} 用法 ${n + 1}`
        if (!Array.isArray(sense?.meanings) || sense.meanings.length === 0)
          errors.push(`${where}: meanings が 1 つ以上の配列ではない`)
        else if (sense.meanings.some((m) => !isText(m?.meaning)))
          errors.push(`${where}: 空の訳がある`)
        for (const key of ['example', 'exampleTranslation'])
          if (!isText(sense?.[key])) errors.push(`${where}: ${key} がない`)
        for (const key of ['exampleTarget', 'exampleTranslationTarget'])
          if (sense?.[key] !== undefined && !isText(sense[key]))
            errors.push(`${where}: ${key} が空でない文字列ではない`)
      })
    if (item.idioms !== undefined) {
      if (!Array.isArray(item.idioms))
        errors.push(`${label}: idioms が配列ではない`)
      else if (
        item.idioms.some((d) => !isText(d?.phrase) || !isText(d?.meaning))
      )
        errors.push(`${label}: phrase か meaning のないイディオムがある`)
    }
  })
  return errors
}

const splitMeaning = (m) => m.split('、')

/**
 * 選定・順序（NGSL の順位どおりか）
 * @param {object[]} items
 * @param {object} manifest
 * @param {Map<number, string>} ranks 順位 → 見出し語
 * @param {number[]} skipped 飛ばした順位
 */
export function checkSelection(items, manifest, ranks, skipped = []) {
  const errors = []
  if (manifest.id !== PACK_ID)
    errors.push(`manifest.json の id が ${PACK_ID} ではない`)
  if (manifest.license !== LICENSE)
    errors.push(`manifest.json の license が ${LICENSE} ではない`)
  if (typeof manifest.attribution !== 'string' || !manifest.attribution.trim())
    errors.push('manifest.json の attribution がない')
  const units = manifest.units ?? []
  if (
    units.length !== UNIT_TITLES.length ||
    units.some((u, i) => u.id !== i + 1 || u.title !== UNIT_TITLES[i])
  )
    errors.push(
      `manifest.json の units が ${UNIT_TITLES.join('・')} の 2 つではない`,
    )

  let expected
  try {
    expected = expectedRanks(ranks, skipped)
  } catch (e) {
    errors.push(e.message)
    return errors
  }
  if (items.length !== expected.length)
    errors.push(`単語の数が ${expected.length} ではない（${items.length}）`)
  items.forEach((item, i) => {
    const rank = expected[i]
    if (rank === undefined) return
    const label = `${i + 1} 番目の単語`
    if (item.id !== `ngsl-${rank}`)
      errors.push(`${label}: id が ngsl-${rank} ではない（${item.id}）`)
    if (item.word !== ranks.get(rank))
      errors.push(
        `${label}: word が順位 ${rank} の ${ranks.get(rank)} ではない（${item.word}）`,
      )
    const unit = Math.floor(i / UNIT_SIZE) + 1
    if (item.unit !== unit)
      errors.push(`${label}: unit が ${unit} ではない（${item.unit}）`)
  })
  return errors
}

/**
 * 訳・イディオム・太字・exampleTarget
 * @param {object[]} items
 * @param {Map<string, string[]>} entries 辞書（parseDictionary の結果）
 * @param {Set<string>} excluded 使わない訳語
 */
export function checkTranslations(items, entries, excluded = new Set()) {
  const errors = []
  for (const item of items) {
    const label = `${item.id} ${item.word}`
    if (!entries.has(item.word)) {
      errors.push(`${label}: EJDict-hand に見出し語の項目がない`)
      continue
    }
    const { candidates } = candidatesFor(entries, item.word, excluded)
    ;(item.senses ?? []).forEach((sense, n) => {
      const where = `${label} 用法 ${n + 1}`
      const meanings = []
      for (const m of sense.meanings ?? []) {
        for (const part of splitMeaning(m.meaning ?? '')) {
          meanings.push(part)
          if (!candidates.has(part))
            errors.push(`${where}: 訳語「${part}」が EJDict-hand の候補にない`)
        }
      }
      const target = sense.exampleTranslationTarget
      if (target !== undefined) {
        if (!sense.exampleTranslation?.includes(target))
          errors.push(`${where}: 太字「${target}」が例文の訳に含まれていない`)
        if (!meanings.some((m) => isInflectionOf(target, m)))
          errors.push(
            `${where}: 太字「${target}」がその用法の訳語の活用した形ではない`,
          )
      }
      if (
        sense.exampleTarget !== undefined &&
        !sense.example?.includes(sense.exampleTarget)
      )
        errors.push(
          `${where}: exampleTarget「${sense.exampleTarget}」が例文に含まれていない`,
        )
    })
    const heads = new Set(idiomHeadsFor(entries, item.word))
    for (const idiom of item.idioms ?? []) {
      const where = `${label} イディオム「${idiom.phrase}」`
      if (!heads.has(idiom.phrase)) {
        errors.push(
          `${where}: EJDict-hand の熟語の項目（見出し語を含み、括弧のないもの）にない`,
        )
        continue
      }
      const ic = candidatesFor(entries, idiom.phrase, excluded).candidates
      for (const part of splitMeaning(idiom.meaning ?? '')) {
        if (!ic.has(part))
          errors.push(`${where}: 意味「${part}」が EJDict-hand の候補にない`)
      }
    }
  }
  return errors
}

/**
 * 音声の生成の記録（audio-sources.json）と items.json の一致
 * 記録の形: { files: [{ file, sha256, duration, entries: [{ id, sense, text, start, end }] }] }
 * sense は単語の音声なら null、例文なら用法の番号（1 から）
 */
export function checkAudioRecord(items, sources, tolerance = 0.0005) {
  const errors = []
  const recorded = new Map()
  for (const f of sources.files) {
    for (const e of f.entries) {
      if (e?.sense !== null && !(Number.isInteger(e?.sense) && e.sense >= 1)) {
        errors.push(
          `記録の項目 ${e?.id} の sense が null でも正の整数でもない（${e?.sense}）`,
        )
        continue
      }
      const key = `${e.id}#${e.sense ?? 'word'}`
      if (recorded.has(key)) errors.push(`記録の項目 ${key} が重複している`)
      recorded.set(key, { ...e, file: f.file })
    }
  }
  const close = (a, b) =>
    typeof a === 'number' &&
    typeof b === 'number' &&
    Math.abs(a - b) <= tolerance
  const same = (audio, rec) =>
    audio.file === rec.file &&
    close(audio.start, rec.start) &&
    close(audio.end, rec.end)
  // 照らし合わせに使った記録を消していき、最後に残ったもの（消した単語・用法の古い記録）を報告する
  const take = (key) => {
    const r = recorded.get(key)
    recorded.delete(key)
    return r
  }
  for (const item of items) {
    const label = `${item.id} ${item.word}`
    const rec = take(`${item.id}#word`)
    if (!item.audio) errors.push(`${label}: 単語の音声がない`)
    else if (!rec) errors.push(`${label}: 単語の音声が生成の記録にない`)
    else {
      if (rec.text !== item.word)
        errors.push(
          `${label}: 記録の読み上げた文「${rec.text}」が見出し語と違う`,
        )
      if (!same(item.audio, rec))
        errors.push(`${label}: 単語の音声の区間が記録と違う`)
    }
    ;(item.senses ?? []).forEach((sense, n) => {
      const where = `${label} 用法 ${n + 1}`
      const r = take(`${item.id}#${n + 1}`)
      if (!sense.exampleAudio) errors.push(`${where}: 例文の音声がない`)
      else if (!r) errors.push(`${where}: 例文の音声が生成の記録にない`)
      else {
        if (r.text !== sense.example)
          errors.push(`${where}: 記録の読み上げた文が例文と違う`)
        if (!same(sense.exampleAudio, r))
          errors.push(`${where}: 例文の音声の区間が記録と違う`)
      }
    })
  }
  for (const key of recorded.keys())
    errors.push(
      `記録の項目 ${key} が items.json のどの音声にも当たらない（古い記録が残っている）`,
    )
  return errors
}
