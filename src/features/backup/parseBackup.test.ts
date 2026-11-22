import { describe, expect, it } from 'vitest'
import { parseRecordsBackup } from './parseBackup'
import { BACKUP_FORMAT, BACKUP_VERSION } from './recordsFile'

const progress = {
  packId: 'pack-a',
  itemId: 'w1',
  mastery: 0.4,
  lastReviewedAt: 10,
  lastReviewedAtByFace: { en: 10 },
}
const session = {
  id: 's1',
  packId: 'pack-a',
  startedAt: 5,
  mode: 'unit',
  face: 'en',
  itemIds: ['w1', 'w2'],
  seconds: [3, 8],
  ratings: 'uf',
}
const report = { id: 'r1', at: 7, packId: 'pack-a', itemId: 'w1' }
const settings = [
  { key: 'face', value: 'ja' },
  { key: 'unitStudy', value: { mixCount: 0, mixSessionRange: 10 } },
  { key: 'exampleTextShown', value: true },
  { key: 'lastTest:pack-a', value: { at: 1, fromUnit: 1, toUnit: 2 } },
  { key: 'lastUnitStudy:pack-a', value: { at: 1, unitId: 3 } },
]

function file(overrides: Record<string, unknown> = {}) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: 100,
    progress: [progress],
    studySessions: [session],
    reports: [report],
    settings,
    ...overrides,
  }
}

const parse = (v: unknown) => parseRecordsBackup(JSON.stringify(v))

/** 確かめが失敗し、誤りの文に text が含まれること */
function expectError(v: unknown, text: string) {
  const result = parse(v)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.errors.join('\n')).toContain(text)
}

describe('parseRecordsBackup', () => {
  it('正しいファイルは、そのまま読める', () => {
    expect(parse(file())).toEqual({ ok: true, backup: file() })
  })

  it('空の記録も読める', () => {
    const empty = file({
      progress: [],
      studySessions: [],
      reports: [],
      settings: [],
    })
    expect(parse(empty)).toEqual({ ok: true, backup: empty })
  })

  it('JSON でないファイルを断る。zip なら取り込みの画面を案内する', () => {
    expect(parseRecordsBackup('{')).toEqual({
      ok: false,
      errors: [expect.stringContaining('JSON ではありません')],
    })
    expect(parseRecordsBackup('PK\u0003\u0004...')).toEqual({
      ok: false,
      errors: [expect.stringContaining('「取り込み」の画面')],
    })
  })

  it('このアプリのファイルでなければ断る', () => {
    expectError([], 'このアプリの学習記録のファイルではありません')
    expectError(
      file({ format: 'other' }),
      'このアプリの学習記録のファイルではありません',
    )
  })

  it('版が正しくない・アプリより新しいときは断る', () => {
    expectError(file({ version: 0 }), '版（version）が正しくありません')
    expectError(file({ version: '1' }), '版（version）が正しくありません')
    expectError(file({ version: BACKUP_VERSION + 1 }), 'アプリを更新してから')
  })

  it('日時や一覧がないときは断る', () => {
    expectError(file({ exportedAt: undefined }), 'exportedAt')
    expectError(
      file({ progress: undefined }),
      'progress: 一覧（配列）ではありません',
    )
  })

  it('定着度の記録の形・範囲・重複を確かめる', () => {
    const bad = (p: Record<string, unknown>) =>
      file({ progress: [{ ...progress, ...p }] })
    expectError(bad({ itemId: '' }), 'progress[0]: packId・itemId')
    expectError(bad({ mastery: 1.5 }), '0〜1')
    expectError(bad({ mastery: -0.1 }), '0〜1')
    expectError(bad({ lastReviewedAt: 'x' }), 'lastReviewedAt')
    expectError(bad({ lastReviewedAtByFace: { xx: 1 } }), '表面の種類ごと')
    expectError(bad({ lastReviewedAtByFace: { en: -1 } }), '表面の種類ごと')
    expectError(
      file({ progress: [progress, progress] }),
      'progress[1]: 同じ単語',
    )
    expectError(file({ progress: [1] }), 'progress[0]: 形が違います')
  })

  it('回答の記録の形・値・重複を確かめる', () => {
    const bad = (s: Record<string, unknown>) =>
      file({ studySessions: [{ ...session, ...s }] })
    expectError(bad({ id: '' }), 'id・packId')
    expectError(bad({ mode: 'quiz' }), 'mode')
    expectError(bad({ face: 'xx' }), 'face')
    expectError(bad({ itemIds: ['w1', 2] }), 'itemIds')
    expectError(bad({ seconds: [3, 1.5] }), 'seconds')
    expectError(bad({ seconds: [3, -1] }), 'seconds')
    expectError(bad({ ratings: 'ux' }), 'ratings')
    expectError(bad({ ratings: 'u' }), '長さが合いません')
    expectError(
      file({ studySessions: [session, session] }),
      'studySessions[1]: 同じ id',
    )
  })

  it('報告の形と、id・単語の重複を確かめる', () => {
    expectError(file({ reports: [{ ...report, at: null }] }), 'reports[0]')
    expectError(
      file({ reports: [report, { ...report, id: 'r2' }] }),
      'reports[1]: 報告が重複',
    )
    expectError(
      file({ reports: [report, { ...report, itemId: 'w2' }] }),
      'reports[1]: 報告が重複',
    )
  })

  it('設定の値の形を、読み出しと同じ決まりで確かめる', () => {
    const bad = (key: string, value: unknown) =>
      file({ settings: [{ key, value }] })
    expectError(bad('face', 'xx'), 'face の値')
    expectError(bad('exampleTextShown', 'yes'), 'exampleTextShown の値')
    expectError(bad('lastTest:pack-a', { at: 1 }), 'lastTest:pack-a の値')
    expectError(bad('lastUnitStudy:pack-a', null), 'lastUnitStudy:pack-a の値')
    expectError(bad('unitStudy', 3), 'unitStudy の値')
    expectError(
      file({ settings: [settings[0], settings[0]] }),
      'settings[1]: 同じキー',
    )
  })

  it('ユニット学習の設定は、読み出しと同じく範囲の外の項目を初期値に直して受け付ける', () => {
    const result = parse(
      file({
        settings: [
          { key: 'unitStudy', value: { mixCount: 999, mixSessionRange: 3 } },
        ],
      }),
    )
    expect(result.ok && result.backup.settings).toEqual([
      { key: 'unitStudy', value: { mixCount: 5, mixSessionRange: 3 } },
    ])
  })

  it('捨てるキーは、重複していても断らない', () => {
    const inProgress = { key: 'inProgress:pack-a', value: {} }
    const result = parse(file({ settings: [inProgress, inProgress] }))
    expect(result.ok && result.backup.settings).toEqual([])
  })

  it('知らないキーと、ファイルに含めないキーの設定は捨てる', () => {
    const result = parse(
      file({
        settings: [
          settings[0],
          { key: 'inProgress:pack-a', value: {} },
          { key: 'lastExport', value: 1 },
          { key: 'unknown', value: 'x' },
        ],
      }),
    )
    expect(result.ok && result.backup.settings).toEqual([settings[0]])
  })

  it('記録にない項目は読み込まない', () => {
    const result = parse(
      file({ reports: [{ ...report, extra: 'x' }], extra: 'x' }),
    )
    expect(result.ok && result.backup).toEqual(file())
  })

  it('誤りは 20 件までにする', () => {
    const result = parse(file({ progress: Array(30).fill(1) }))
    expect(!result.ok && result.errors.length).toBe(20)
  })
})
