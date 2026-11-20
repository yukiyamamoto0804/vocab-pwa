import type { ContentItem, Manifest, ManifestUnit } from '../../db/types'

export interface UnitAssignment {
  /** ユニットの一覧（番号順） */
  units: ManifestUnit[]
  /** items と同じ順で、各単語の所属ユニット番号 */
  unitOfItems: number[]
}

// 単語をユニットに割り当てる（docs/specs/study-cards.md 6 章「ユニットの分け方」）。
// 教材で指定されていればそれに従い（単語のないユニットは除く）、なければ並び順で unitSize 語ずつ区切る。
// 指定の有無と整合性は validatePack で確認済みであること。
export function assignUnits(
  manifest: Manifest,
  items: ContentItem[],
  unitSize: number,
): UnitAssignment {
  const specified = items.map((item) => item.unit)
  if (specified.every((unit) => unit !== undefined)) {
    // 単語が 1 つもないユニットは作らない
    const used = new Set(specified)
    return {
      units: (manifest.units ?? [])
        .filter((u) => used.has(u.id))
        .sort((a, b) => a.id - b.id),
      unitOfItems: specified,
    }
  }
  const unitCount = Math.ceil(items.length / unitSize)
  return {
    units: Array.from({ length: unitCount }, (_, i) => ({ id: i + 1 })),
    unitOfItems: items.map((_, i) => Math.floor(i / unitSize) + 1),
  }
}
