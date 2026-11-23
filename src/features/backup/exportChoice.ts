import {
  EXPORT_KINDS,
  type ExportChoice,
  type ExportKind,
} from '../../db/settings'

// エクスポートの選び方（docs/specs/backup.md 2 章）

export interface ExportSelection {
  kind: ExportKind
  /** 選んだパック */
  packIds: Set<string>
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === 'string')
const isExportKind = (v: unknown): v is ExportKind =>
  EXPORT_KINDS.some((k) => k === v)

/**
 * 画面を開いたときの選び方。保存した前回の選び方を使い、前回の後に取り込んだパック（デモ教材を除く）は選んだ状態にする。
 * 保存していない・形の違う値なら、「学習記録だけ」で、デモ教材以外のパックをすべて選んだ状態にする
 */
export function initialExportSelection(
  stored: unknown,
  packIds: readonly string[],
  demoPackId: string,
): ExportSelection {
  const notDemo = (id: string) => id !== demoPackId
  const s =
    typeof stored === 'object' && stored !== null
      ? (stored as Record<string, unknown>)
      : {}
  if (
    !isExportKind(s.kind) ||
    !isStringArray(s.packIds) ||
    !isStringArray(s.knownPackIds)
  )
    return { kind: 'records', packIds: new Set(packIds.filter(notDemo)) }
  const selected = new Set(s.packIds)
  const known = new Set(s.knownPackIds)
  return {
    kind: s.kind,
    packIds: new Set(
      packIds.filter(
        (id) => selected.has(id) || (!known.has(id) && notDemo(id)),
      ),
    ),
  }
}

/** 保存する選び方。packIds は今あるパックの並びの順にする */
export function exportChoiceToSave(
  selection: ExportSelection,
  packIds: readonly string[],
): ExportChoice {
  return {
    kind: selection.kind,
    packIds: packIds.filter((id) => selection.packIds.has(id)),
    knownPackIds: [...packIds],
  }
}

/** 選び方に学習記録・教材が含まれるか */
export const includesRecords = (kind: ExportKind) => kind !== 'packs'
export const includesPacks = (kind: ExportKind) => kind !== 'records'
