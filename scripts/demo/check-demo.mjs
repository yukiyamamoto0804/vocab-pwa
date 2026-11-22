// デモ教材の中身を確かめる（docs/RULES.md 11 章、docs/specs/demo-pack.md 3 章）。
//   node scripts/demo/check-demo.mjs [demo フォルダ]      確かめる。合格なら 0、不合格なら理由を出して 1 で終わる
//   node scripts/demo/check-demo.mjs --candidates         40 語と熟語の訳語の候補を JSON で書き出す（作る担当に渡す一覧）
// 材料（NGSL 1.2・EJDict-hand）は固定した版を取得して .cache/ に置く（lib/materials.mjs）
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  checkAudioRecord,
  checkSelection,
  checkShape,
  checkTranslations,
  expectedRanks,
} from './lib/checks.mjs'
import { EXCLUDED, SKIPPED_RANKS } from './lib/config.mjs'
import { candidatesFor, idiomHeadsFor, parseDictionary } from './lib/ejdict.mjs'
import { EJDICT_COMMIT, loadEjdict, loadNgsl, NGSL } from './lib/materials.mjs'

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`${path} を読めません（${e.message}）`)
  }
}

/** demo/README.md に、材料の版と飛ばした順位が書かれているか（docs/specs/demo-pack.md 3 章） */
function checkReadme(dir) {
  const path = join(dir, 'README.md')
  if (!existsSync(path)) return ['README.md がない']
  const text = readFileSync(path, 'utf8')
  const errors = []
  for (const [what, value] of [
    ['EJDict-hand のコミット', EJDICT_COMMIT],
    ['NGSL の CSV の SHA-256', NGSL.sha256],
  ])
    if (!text.includes(value))
      errors.push(`README.md に${what}（${value}）が書かれていない`)
  for (const rank of SKIPPED_RANKS)
    if (!text.includes(String(rank)))
      errors.push(`README.md に飛ばした順位 ${rank} が書かれていない`)
  return errors
}

async function main(args) {
  const ranks = await loadNgsl()
  const entries = parseDictionary(await loadEjdict())

  if (args[0] === '--candidates') {
    // skipped は、対の合わない括弧のために使えなかった部分（作る担当が、行にはあるが使えない訳語を見分けるため）
    const describe = (head) => {
      const r = candidatesFor(entries, head, EXCLUDED)
      return {
        entries: entries.get(head) ?? [],
        candidates: [...r.candidates],
        skipped: r.skipped,
      }
    }
    const list = expectedRanks(ranks, SKIPPED_RANKS).map((rank) => {
      const word = ranks.get(rank)
      const idioms = idiomHeadsFor(entries, word)
        .map((phrase) => ({ phrase, ...describe(phrase) }))
        .filter((i) => i.candidates.length)
      return { rank, id: `ngsl-${rank}`, word, ...describe(word), idioms }
    })
    process.stdout.write(`${JSON.stringify(list, null, 2)}\n`)
    return 0
  }

  const dir = args[0] ?? 'demo'
  const manifest = readJson(join(dir, 'manifest.json'))
  const items = readJson(join(dir, 'items.json'))
  const sources = readJson(join(dir, 'audio-sources.json'))
  const shape = checkShape(items, manifest, sources)
  const errors = shape.length
    ? shape
    : [
        ...checkSelection(items, manifest, ranks, SKIPPED_RANKS),
        ...checkTranslations(items, entries, EXCLUDED),
        ...checkAudioRecord(items, sources),
        ...checkReadme(dir),
      ]
  if (errors.length) {
    for (const e of errors) console.error(`- ${e}`)
    console.error(`\nデモ教材の確かめ: ${errors.length} 件の問題があります`)
    return 1
  }
  console.log(`デモ教材の確かめ: 合格（${items.length} 語）`)
  return 0
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(`デモ教材の確かめ: ${e.message}`)
    process.exit(1)
  },
)
