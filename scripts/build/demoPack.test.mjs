import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPackZip } from '../../src/features/content-pack/readZip.ts'
import { validatePack } from '../../src/features/content-pack/validate.ts'
import { readDemo } from './demoPack.ts'

// デモ教材（demo/）を、配信するのと同じ zip にして、アプリの取り込みと同じ道筋で検証する
// （docs/specs/demo-pack.md 3 章）。品詞の誤りや、zip に入らない名前の音声などを、配信する前に見つけるため。
// demo/ がなければ飛ばす
const DEMO = join(import.meta.dirname, '..', '..', 'demo')

describe.skipIf(!existsSync(join(DEMO, 'manifest.json')))('demo/', () => {
  it('配信する zip が、アプリの取り込みの検証に通る', () => {
    const demo = readDemo(DEMO)
    const zip = readPackZip(demo.zip)
    expect(zip.ok ? [] : zip.errors).toEqual([])
    const result = validatePack(
      zip.manifest,
      zip.items,
      new Map([...zip.audio].map(([file, data]) => [file, data.length])),
    )
    expect(result.ok ? [] : result.errors).toEqual([])
    expect(result.ok && result.manifest.id).toBe('demo-ngsl')
  })
})
