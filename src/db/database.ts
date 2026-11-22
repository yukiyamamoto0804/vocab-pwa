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
// 構造を変えるときはバージョンを上げる。既存の記録の形を変える・値を作り直すときは upgrade で移し替える
// （索引を足す・消すだけなら、IndexedDB が既存の記録から作り直すので不要）。
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
    // 2: パックごとの学習の記録を新しい順に読むための索引を足す（listRecentSessions）。
    // 使わなくなった startedAt・packId だけの索引は外す（packId だけで探すときも、複合索引の先頭で足りる）。
    // 索引のもとの packId と startedAt は既存の記録にも入っているので、索引は自動で作られ、移し替えは要らない
    this.version(2).stores({
      studySessions: 'id, [packId+startedAt]',
    })
  }
}

export const db = new VocabDatabase()
