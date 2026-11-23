import { describe, expect, it } from 'vitest'
import { exportChoiceToSave, initialExportSelection } from './exportChoice'

const DEMO = 'demo'

describe('initialExportSelection', () => {
  it('保存していなければ、学習記録だけで、デモ以外のパックを選ぶ', () => {
    expect(initialExportSelection(undefined, ['a', DEMO, 'b'], DEMO)).toEqual({
      kind: 'records',
      packIds: new Set(['a', 'b']),
    })
  })

  it('形の違う値は、保存していないものとして扱う', () => {
    for (const stored of [
      'x',
      { kind: 'all', packIds: [], knownPackIds: [] },
      { kind: 'packs', packIds: [1], knownPackIds: [] },
      { kind: 'packs', packIds: [] },
    ])
      expect(initialExportSelection(stored, ['a'], DEMO)).toEqual({
        kind: 'records',
        packIds: new Set(['a']),
      })
  })

  it('前回の選び方を使い、前回の後に取り込んだパックはデモ以外を選ぶ', () => {
    const stored = {
      kind: 'records-and-packs',
      packIds: ['a', 'gone'],
      knownPackIds: ['a', 'b', 'gone'],
    }
    expect(initialExportSelection(stored, ['a', 'b', 'c', DEMO], DEMO)).toEqual(
      { kind: 'records-and-packs', packIds: new Set(['a', 'c']) },
    )
  })

  it('前回選んだデモは、そのまま選ぶ', () => {
    const stored = { kind: 'packs', packIds: [DEMO], knownPackIds: [DEMO] }
    expect(initialExportSelection(stored, [DEMO], DEMO)).toEqual({
      kind: 'packs',
      packIds: new Set([DEMO]),
    })
  })
})

describe('exportChoiceToSave', () => {
  it('選んだパックを今の並びの順にし、今あるパックを覚える', () => {
    expect(
      exportChoiceToSave(
        { kind: 'packs', packIds: new Set(['b', 'gone', 'a']) },
        ['a', 'b', 'c'],
      ),
    ).toEqual({
      kind: 'packs',
      packIds: ['a', 'b'],
      knownPackIds: ['a', 'b', 'c'],
    })
  })
})
