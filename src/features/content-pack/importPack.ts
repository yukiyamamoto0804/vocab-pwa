import { db as defaultDb, type VocabDatabase } from '../../db/database'
import { type ReplaceSummary, replacePack } from '../../db/packs'
import type {
  AudioFileRecord,
  ContentItem,
  ItemRecord,
  PackRecord,
  UnitRecord,
} from '../../db/types'
import { isQuotaError } from '../../lib/errors'
import { studyConfig } from '../studyConfig'
import type { PackError } from './packError'
import { readPackZip } from './readZip'
import { assignUnits } from './units'
import { validatePack } from './validate'

export type ImportResult =
  | ({
      ok: true
      packId: string
      title: string
      itemCount: number
      unitCount: number
    } & ReplaceSummary)
  | { ok: false; errors: PackError[] }

interface ImportOptions {
  db?: VocabDatabase
  /** 取り込み日時（エポックミリ秒） */
  now?: number
}

// 教材パック（zip）を展開・検証して、端末内に保存する
export async function importPack(
  bytes: Uint8Array,
  { db = defaultDb, now = Date.now() }: ImportOptions = {},
): Promise<ImportResult> {
  const zip = readPackZip(bytes)
  if (!zip.ok) return zip

  const checked = validatePack(
    zip.manifest,
    zip.items,
    new Set(zip.audio.keys()),
  )
  if (!checked.ok) return checked
  const { manifest, items } = checked
  const packId = manifest.id

  const { units, unitOfItems } = assignUnits(
    manifest,
    items,
    studyConfig.unitSize,
  )

  const pack: PackRecord = { id: packId, manifest, importedAt: now }
  const unitRecords: UnitRecord[] = units.map((u) => ({ packId, ...u }))
  const itemRecords: ItemRecord[] = items.map(({ unit: _, ...item }, i) => ({
    ...item,
    packId,
    unit: unitOfItems[i],
    order: i,
  }))
  // 単語から参照されている音声だけを保存する。
  // Blob にした音声は展開結果から外し、メモリを早めに手放せるようにする
  const used = referencedAudio(items)
  const audioFiles: AudioFileRecord[] = []
  for (const [file, data] of zip.audio) {
    zip.audio.delete(file)
    if (used.has(file))
      audioFiles.push({
        packId,
        file,
        blob: new Blob([data], { type: audioType(file) }),
      })
  }

  try {
    const summary = await replacePack(
      {
        pack,
        units: unitRecords,
        items: itemRecords,
        audioFiles,
      },
      db,
    )
    return {
      ok: true,
      packId,
      title: manifest.title,
      itemCount: itemRecords.length,
      unitCount: unitRecords.length,
      ...summary,
    }
  } catch (e) {
    const quota = isQuotaError(e)
    return {
      ok: false,
      errors: [
        {
          where: '保存',
          message: quota
            ? '端末の保存容量が足りません。空き容量を増やしてから、もう一度取り込んでください'
            : `保存できませんでした（${e instanceof Error ? e.message : String(e)}）`,
        },
      ],
    }
  }
}

function referencedAudio(items: ContentItem[]): Set<string> {
  const files = new Set<string>()
  for (const item of items) {
    if (item.audio) files.add(item.audio.file)
    for (const sense of item.senses)
      if (sense.exampleAudio) files.add(sense.exampleAudio.file)
  }
  return files
}

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
}

function audioType(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_TYPES[ext] ?? ''
}
