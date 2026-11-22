// pre-commit から呼ぶ。ステージされたデモ教材（demo/）を、作業中のファイルではなくステージの内容で確かめる
// （docs/RULES.md 11 章、docs/specs/demo-pack.md 7 章）。
//   1. demo/ に置いてよいファイル（通常のファイル）だけがあるか
//   2. 音声: demo/audio/ の直下の demo-*.m4a で、1 MB 以下、items.json から使われていて、
//      SHA-256 が audio-sources.json にあるものだけか。items.json から使われている音声がすべてあるか
//   3. 中身を確かめる道具（scripts/demo/check-demo.mjs）に、ステージの内容で通るか
//      道具そのものは作業中のファイルを実行するので、scripts/demo/ にステージしていない変更があれば止める
//      （コミットされる版と違う道具で判定しないため）
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const MAX_AUDIO_BYTES = 1024 * 1024
const ALLOWED =
  /^demo\/(manifest\.json|items\.json|audio-sources\.json|README\.md|LICENSE|audio\/demo-[A-Za-z0-9_-]+\.m4a)$/
const ALLOWED_TEXT =
  'manifest.json・items.json・audio-sources.json・README.md・LICENSE・audio/demo-*.m4a（名前は英数字と - _）'
const CHECKER = 'scripts/demo/check-demo.mjs'

const git = (...args) =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    maxBuffer: 64 * 1024 * 1024,
  })
const errors = []

// ステージにある demo/ のファイル（変更していないものも含む。全体で確かめるため）。
// 形式: <モード> <ハッシュ> <ステージ番号>\t<パス>
const entries = git('ls-files', '--stage', '-z', '--', 'demo/')
  .toString()
  .split('\0')
  .filter(Boolean)
  .map((line) => {
    const [meta, path] = line.split('\t')
    return { mode: meta.split(' ')[0], path }
  })

// demo/ がまだない（道具だけを先にコミットするときなど）なら、確かめるものはない
if (entries.length === 0) process.exit(0)

const unstaged = [
  ...git('diff', '--name-only', '-z', '--', 'scripts/demo/')
    .toString()
    .split('\0'),
  ...git(
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    'scripts/demo/',
  )
    .toString()
    .split('\0'),
].filter(Boolean)
if (unstaged.length) {
  for (const p of unstaged) console.error(`- ${p}`)
  console.error(
    '- 中身を確かめる道具（scripts/demo/）に、ステージしていない変更があります。ステージするか、元に戻してください',
  )
  process.exit(1)
}

const usable = []
for (const { mode, path } of entries) {
  if (mode !== '100644') {
    // シンボリックリンク・実行ファイル・サブモジュールは、中身を確かめられないので置かない
    errors.push(
      `demo/ には通常のファイルだけを置けます: ${path}（モード ${mode}）`,
    )
  } else if (!ALLOWED.test(path)) {
    errors.push(
      `demo/ に置けないファイルです: ${path}（置けるのは ${ALLOWED_TEXT}）`,
    )
  } else {
    usable.push(path)
  }
}

// 大きさを先に確かめてから読み込む（大きなファイルを誤って置いたときに、理由の分からない失敗にしないため）
const staged = new Map()
for (const path of usable) {
  const size = Number(git('cat-file', '-s', `:${path}`).toString().trim())
  if (path.startsWith('demo/audio/') && size > MAX_AUDIO_BYTES) {
    errors.push(`${path} が 1 MB を超えています（${size} バイト）`)
    continue
  }
  staged.set(path, git('show', `:${path}`))
}

const readJson = (p) => {
  const data = staged.get(p)
  if (!data) {
    errors.push(`${p} がステージにありません`)
    return undefined
  }
  try {
    return JSON.parse(data.toString('utf8'))
  } catch (e) {
    errors.push(`${p} を JSON として読めません: ${e.message}`)
    return undefined
  }
}

const items = readJson('demo/items.json')
const sources = readJson('demo/audio-sources.json')
if (items !== undefined && !Array.isArray(items))
  errors.push('demo/items.json が配列ではありません')
if (sources !== undefined && !Array.isArray(sources?.files))
  errors.push('demo/audio-sources.json の files が配列ではありません')

if (errors.length === 0) {
  const used = new Set()
  for (const item of items) {
    if (item?.audio?.file) used.add(item.audio.file)
    for (const sense of Array.isArray(item?.senses) ? item.senses : [])
      if (sense?.exampleAudio?.file) used.add(sense.exampleAudio.file)
  }
  const recorded = new Map(sources.files.map((f) => [f?.file, f?.sha256]))
  const audioPaths = [...staged.keys()].filter((p) =>
    p.startsWith('demo/audio/'),
  )
  const present = new Set(audioPaths.map((p) => p.slice('demo/audio/'.length)))
  for (const p of audioPaths) {
    const name = p.slice('demo/audio/'.length)
    if (!used.has(name)) errors.push(`${p} は items.json から使われていません`)
    const sha = createHash('sha256').update(staged.get(p)).digest('hex')
    if (recorded.get(name) !== sha)
      errors.push(`${p} の SHA-256 が audio-sources.json の記録と合いません`)
  }
  for (const name of used) {
    if (!present.has(name))
      errors.push(
        `items.json が使う音声 demo/audio/${name} がステージにありません`,
      )
  }
}

if (errors.length === 0) {
  if (!existsSync(CHECKER)) {
    errors.push(`中身を確かめる道具 ${CHECKER} がありません`)
  } else {
    // ステージの内容を一時フォルダに取り出して、道具に確かめさせる
    const dir = mkdtempSync(join(tmpdir(), 'staged-demo-'))
    try {
      for (const [p, data] of staged) {
        const out = join(dir, p)
        mkdirSync(dirname(out), { recursive: true })
        writeFileSync(out, data)
      }
      // フックを動かしている Node.js と同じものを使う
      execFileSync(process.execPath, [CHECKER, join(dir, 'demo')], {
        stdio: 'inherit',
      })
    } catch {
      errors.push('中身を確かめる道具に通りませんでした（上の出力を参照）')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`- ${e}`)
  process.exit(1)
}
