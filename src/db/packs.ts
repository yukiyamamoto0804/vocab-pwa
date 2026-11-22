import { db as defaultDb, type VocabDatabase } from './database'
import type {
  AudioFileRecord,
  ItemRecord,
  PackRecord,
  UnitRecord,
} from './types'

export interface PackContent {
  pack: PackRecord
  units: UnitRecord[]
  items: ItemRecord[]
  audioFiles: AudioFileRecord[]
}

/** 取り込み直したときに、単語がどう変わったか */
export interface ReplaceSummary {
  /** 同じ id のパックがあり、入れ替えたか */
  replaced: boolean
  added: number
  removed: number
  /** 同じ id で、内容（見出し語・解説・音声の指定・ユニット）が変わった単語 */
  changed: number
  unchanged: number
}

// 教材パックを保存する。同じ id のパックがあれば、その教材を全て入れ替える。
// 学習記録（progress など）には触れないので、id が同じ単語の記録は引き継がれる。
// 取り込み直しても一覧の並びが変わらないよう、最初に取り込んだ日時は残す。
// 途中で失敗した場合は何も書き込まれない（1 つのトランザクション）。
export async function replacePack(
  content: PackContent,
  db: VocabDatabase = defaultDb,
): Promise<ReplaceSummary> {
  const packId = content.pack.id
  return db.transaction(
    'rw',
    [db.packs, db.units, db.items, db.audioFiles],
    async () => {
      const old = await db.packs.get(packId)
      const replaced = old !== undefined
      const oldItems = await db.items.where('packId').equals(packId).toArray()
      await db.units.where('packId').equals(packId).delete()
      await db.items.where('packId').equals(packId).delete()
      await db.audioFiles.where('packId').equals(packId).delete()
      await db.packs.put(
        old ? { ...content.pack, importedAt: old.importedAt } : content.pack,
      )
      await db.units.bulkPut(content.units)
      await db.items.bulkPut(content.items)
      await db.audioFiles.bulkPut(content.audioFiles)
      return { replaced, ...compareItems(oldItems, content.items) }
    },
  )
}

/** キーを並べ替えて文字列にする。保存した版によってキーの順番が違っても、同じ内容なら同じ文字列になる */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

// 並び順（order）だけの違いは変更とみなさない。音声は指定（ファイル名と区間）を比べ、ファイルの中身は比べない
function itemKey({ order: _, ...item }: ItemRecord): string {
  return stableStringify(item)
}

function compareItems(oldItems: ItemRecord[], newItems: ItemRecord[]) {
  const oldById = new Map(oldItems.map((item) => [item.id, itemKey(item)]))
  let added = 0
  let changed = 0
  let unchanged = 0
  for (const item of newItems) {
    const old = oldById.get(item.id)
    if (old === undefined) added += 1
    else if (old === itemKey(item)) unchanged += 1
    else changed += 1
    oldById.delete(item.id)
  }
  return { added, removed: oldById.size, changed, unchanged }
}

export interface PackSummary {
  pack: PackRecord
  itemCount: number
  unitCount: number
}

/** 取り込み済みのパックを、最初に取り込んだ順に返す */
export async function listPacks(
  db: VocabDatabase = defaultDb,
): Promise<PackSummary[]> {
  const packs = await db.packs.toArray()
  packs.sort((a, b) => a.importedAt - b.importedAt)
  return Promise.all(
    packs.map(async (pack) => ({
      pack,
      itemCount: await db.items.where('packId').equals(pack.id).count(),
      unitCount: await db.units.where('packId').equals(pack.id).count(),
    })),
  )
}
