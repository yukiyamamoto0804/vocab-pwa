// デモ教材（demo/）を zip にまとめて配信物に入れ、説明のシートと更新の判定に使う値をアプリに埋め込む
// Vite のプラグイン（docs/specs/demo-pack.md 5 章）。demo/ がなければ、zip を作らず、埋め込む値は null にする
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Zippable, zipSync } from 'fflate'
import type { Plugin } from 'vite'

/** 配信物の中の zip の置き場所（アプリからは相対 URL で受け取る。src/features/demo/demoPack.ts・check-dist.mjs と揃える） */
export const DEMO_ZIP = 'demo/demo-ngsl.zip'

/** アプリに埋め込む値（src/features/demo/demoPack.ts の DemoPackInfo と揃える） */
export interface DemoPackInfo {
  title: string
  createdAt?: string
  license?: string
  attribution?: string
  /** items.json の SHA-256。更新の判定と、zip の URL に付けてブラウザのキャッシュを避けるために使う */
  itemsSha256: string
}

export interface DemoPack {
  info: DemoPackInfo
  zip: Uint8Array
}

/** zip に入れるファイル（docs/specs/demo-pack.md 5 章）。audio/ は直下の demo-*.m4a だけ */
const FILES = ['manifest.json', 'items.json', 'README.md', 'LICENSE']
const AUDIO = /^demo-[A-Za-z0-9_-]+\.m4a$/

export function readDemo(dir: string): DemoPack | null {
  if (!existsSync(join(dir, 'manifest.json'))) return null
  const files: Zippable = {}
  for (const name of FILES) {
    const path = join(dir, name)
    if (!existsSync(path)) throw new Error(`demo/${name} がありません`)
    files[name] = readFileSync(path)
  }
  const audioDir = join(dir, 'audio')
  if (existsSync(audioDir)) {
    // 音声は圧縮しても小さくならないので無圧縮で入れる
    for (const name of readdirSync(audioDir).filter((n) => AUDIO.test(n)))
      files[`audio/${name}`] = [
        readFileSync(join(audioDir, name)),
        { level: 0 },
      ]
  }
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  // 埋め込む値が、アプリの受け取る形とずれないように確かめる
  if (manifest?.id !== 'demo-ngsl' || typeof manifest.title !== 'string')
    throw new Error(
      'demo/manifest.json の id が demo-ngsl でないか、title がありません',
    )
  const itemsSha256 = createHash('sha256')
    .update(readFileSync(join(dir, 'items.json')))
    .digest('hex')
  return {
    info: {
      title: manifest.title,
      createdAt: manifest.createdAt,
      license: manifest.license,
      attribution: manifest.attribution,
      itemsSha256,
    },
    zip: zipSync(files),
  }
}

/** demo/ はプラグインを作るとき（設定を読み込むとき）に 1 回だけ読む。開発サーバーの起動中に demo/ を直したら、再起動する */
export function demoPack(dir: string): Plugin {
  const demo = readDemo(dir)
  return {
    name: 'demo-pack',
    config: () => ({
      define: { __DEMO_PACK__: JSON.stringify(demo?.info ?? null) },
    }),
    // 開発サーバーでも、配信物と同じ URL で zip を配る
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (!demo || !path?.endsWith(`/${DEMO_ZIP}`)) return next()
        res.setHeader('Content-Type', 'application/zip')
        res.end(Buffer.from(demo.zip))
      })
    },
    generateBundle() {
      if (demo)
        this.emitFile({ type: 'asset', fileName: DEMO_ZIP, source: demo.zip })
    },
  }
}
