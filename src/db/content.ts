import { db as defaultDb, type VocabDatabase } from './database'
import type {
  ItemRecord,
  PackRecord,
  ProgressRecord,
  UnitRecord,
} from './types'

// 画面に表示する教材と学習状況の読み出し

export function getPack(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<PackRecord | undefined> {
  return db.packs.get(packId)
}

export function getUnit(
  packId: string,
  unitId: number,
  db: VocabDatabase = defaultDb,
): Promise<UnitRecord | undefined> {
  return db.units.get([packId, unitId])
}

export interface UnitSummary {
  unit: UnitRecord
  itemCount: number
  /** 学習済み（progress に記録がある）単語の数 */
  learnedCount: number
}

/** パックのユニットを番号順に、単語数と学習済みの数を付けて返す */
export async function listUnitSummaries(
  packId: string,
  db: VocabDatabase = defaultDb,
): Promise<UnitSummary[]> {
  const [units, items, progressKeys] = await Promise.all([
    db.units.where('packId').equals(packId).toArray(),
    db.items.where('packId').equals(packId).toArray(),
    db.progress.where('packId').equals(packId).primaryKeys(),
  ])
  const learned = new Set(progressKeys.map(([, itemId]) => itemId))
  const counts = new Map<number, { itemCount: number; learnedCount: number }>()
  for (const item of items) {
    const c = counts.get(item.unit) ?? { itemCount: 0, learnedCount: 0 }
    c.itemCount += 1
    if (learned.has(item.id)) c.learnedCount += 1
    counts.set(item.unit, c)
  }
  return units
    .sort((a, b) => a.id - b.id)
    .map((unit) => ({
      unit,
      ...(counts.get(unit.id) ?? { itemCount: 0, learnedCount: 0 }),
    }))
}

/** ユニットの単語を、パック内の並び順で返す */
export async function listUnitItems(
  packId: string,
  unitId: number,
  db: VocabDatabase = defaultDb,
): Promise<ItemRecord[]> {
  const items = await db.items
    .where('[packId+unit]')
    .equals([packId, unitId])
    .toArray()
  return items.sort((a, b) => a.order - b.order)
}

/** 範囲（開始〜終了のユニット、両端を含む）の単語を、パック内の並び順で返す */
export async function listItemsInUnits(
  packId: string,
  fromUnit: number,
  toUnit: number,
  db: VocabDatabase = defaultDb,
): Promise<ItemRecord[]> {
  const items = await db.items
    .where('[packId+unit]')
    .between([packId, fromUnit], [packId, toUnit], true, true)
    .toArray()
  return items.sort((a, b) => a.order - b.order)
}

/** 指定した単語を、指定した順で返す。ない単語（取り込み直して消えたもの）は除く */
export async function getItems(
  packId: string,
  itemIds: string[],
  db: VocabDatabase = defaultDb,
): Promise<ItemRecord[]> {
  const items = await db.items.bulkGet(
    itemIds.map((id) => [packId, id] as [string, string]),
  )
  return items.filter((item) => item !== undefined)
}

/** 単語ごとの学習状況。記録がない（未学習の）単語は含まない */
export async function getProgressMap(
  packId: string,
  itemIds: string[],
  db: VocabDatabase = defaultDb,
): Promise<Map<string, ProgressRecord>> {
  const records = await db.progress.bulkGet(
    itemIds.map((id) => [packId, id] as [string, string]),
  )
  const map = new Map<string, ProgressRecord>()
  for (const r of records) if (r) map.set(r.itemId, r)
  return map
}

export async function getAudioBlob(
  packId: string,
  file: string,
  db: VocabDatabase = defaultDb,
): Promise<Blob | undefined> {
  return (await db.audioFiles.get([packId, file]))?.blob
}
