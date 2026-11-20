import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  AudioFileRecord,
  ItemRecord,
  PackRecord,
  ProgressRecord,
  ReportRecord,
  SettingRecord,
  StudySessionRecord,
  UnitRecord,
} from './types'

// テーブル構造は docs/ARCHITECTURE.md 4 章。
// 構造を変えるときはバージョンを上げ、マイグレーションを書く。
export class VocabDatabase extends Dexie {
  // 教材
  packs!: EntityTable<PackRecord, 'id'>
  units!: Table<UnitRecord, [string, number]>
  items!: Table<ItemRecord, [string, string]>
  audioFiles!: Table<AudioFileRecord, [string, string]>
  // 学習記録
  progress!: Table<ProgressRecord, [string, string]>
  studySessions!: EntityTable<StudySessionRecord, 'id'>
  reports!: EntityTable<ReportRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>

  constructor(name = 'vocab-pwa') {
    super(name)
    // packId だけでの検索・削除は、複合インデックスの先頭（Dexie の仮想インデックス）で行う
    this.version(1).stores({
      packs: 'id',
      units: '[packId+id]',
      items: '[packId+id], [packId+unit]',
      audioFiles: '[packId+file]',
      progress: '[packId+itemId]',
      studySessions: 'id, startedAt, packId',
      reports: 'id, [packId+itemId]',
      settings: 'key',
    })
  }
}

export const db = new VocabDatabase()
