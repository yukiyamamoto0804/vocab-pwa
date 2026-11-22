// ビルドのあと、配信物（dist/）に入っている教材になりうるファイルが、デモ教材の zip だけであることを確かめる
// （docs/RULES.md 3 章・11 章、docs/specs/demo-pack.md 5 章）。npm run build の最後に実行する
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const DIST = 'dist'
// デモの zip の置き場所は scripts/build/demoPack.ts の DEMO_ZIP と揃える
const ALLOWED = new Set(['demo/demo-ngsl.zip'])
// 教材になりうるもの: zip、よくある音声の形式（取り込みが受け付けるものより広く）、教材の表（CSV）、教材パックの JSON
const SUSPECT =
  /\.(zip|mp3|m4a|mp4|aac|wav|ogg|oga|opus|webm|flac|csv)$|(^|\/)(manifest|items)\.json$/i

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
}

const found = walk(DIST)
  .map((p) => relative(DIST, p).split('\\').join('/'))
  .filter((p) => SUSPECT.test(p) && !ALLOWED.has(p))

if (found.length) {
  for (const p of found) console.error(`- dist/${p}`)
  console.error(
    '\n配信物に、デモ教材の zip 以外の教材になりうるファイルが入っています',
  )
  process.exit(1)
}
console.log('配信物の確かめ: 教材になりうるファイルはデモ教材の zip だけ')
