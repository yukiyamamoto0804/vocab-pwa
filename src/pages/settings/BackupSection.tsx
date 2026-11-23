import { useState } from 'react'
import styles from './BackupSection.module.css'
import { ExportBackup } from './ExportBackup'
import { ImportRecords } from './ImportRecords'

// 設定画面の「バックアップ」（docs/specs/backup.md）
export function BackupSection({ onReplaced }: { onReplaced: () => void }) {
  /** インポートの確認のシートを閉じた回数。シートの中でエクスポートしたときに、最後にエクスポートした日時を読み直させる（作ったファイルは残す） */
  const [sheetClosedCount, setSheetClosedCount] = useState(0)
  return (
    <div className={styles.section}>
      <ExportBackup reloadKey={sheetClosedCount} />
      <ImportRecords
        onReplaced={onReplaced}
        onSheetClosed={() => setSheetClosedCount((n) => n + 1)}
      />
    </div>
  )
}
