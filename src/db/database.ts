import Dexie, { type EntityTable, type Table } from 'dexie'
import { randomId } from '../lib/random'
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
    // 別の画面（新しい版のアプリ）が DB を更新しようとしたら、こちらの接続を閉じて更新を通し、画面に開き直すよう知らせる。
    // 自動で開き直さないよう閉じたままにする。古い版のコードが、新しい版の形に変えたデータへ古い形で書き込まないようにするため
    this.on('versionchange', () => {
      this.close()
      if (typeof window !== 'undefined')
        window.dispatchEvent(new Event(DB_OUTDATED_EVENT))
      return false
    })
  }
}

/** DB を新しい版が更新したため、この画面の接続を閉じたときに window に送るイベントの名前 */
export const DB_OUTDATED_EVENT = 'vocab-db-outdated'

export const db = new VocabDatabase()

// 学習記録をインポートで置き換えたことを、ほかのタブに知らせる（docs/specs/backup.md 6 章）。
// 中身を置き換えただけでは versionchange は届かないため、BroadcastChannel で別に知らせる。
// 同じタブの中でも受け取ってしまうので、送ったタブを印で見分ける
export const RECORDS_REPLACED_CHANNEL = 'vocab-pwa-records-replaced'
const tabId = randomId()

export function notifyRecordsReplaced(): void {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(RECORDS_REPLACED_CHANNEL)
  channel.postMessage(tabId)
  channel.close()
}

/**
 * ほかのタブが学習記録を置き換えたら、この画面の接続を閉じて DB_OUTDATED_EVENT を送る
 * （置き換えた後の記録に、古い回答を書き戻さないように）。戻り値は受け取りをやめる関数
 */
export function listenRecordsReplaced(target: VocabDatabase = db): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const channel = new BroadcastChannel(RECORDS_REPLACED_CHANNEL)
  channel.onmessage = (e: MessageEvent) => {
    if (e.data === tabId) return
    target.close()
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event(DB_OUTDATED_EVENT))
  }
  return () => channel.close()
}
