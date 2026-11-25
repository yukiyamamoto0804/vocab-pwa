import { useState } from 'react'
import { StorageStatus } from '../../components/StorageStatus'
import { BackupSection } from './BackupSection'
import { DisplaySettingsForm } from './DisplaySettingsForm'
import { PlaybackRateForm } from './PlaybackRateForm'
import { UnitStudySettingsForm } from './UnitStudySettingsForm'

export function SettingsPage() {
  /** 学習記録を置き換えた回数。設定の欄を作り直し、置き換えた後の値を読み直させる */
  const [replacedCount, setReplacedCount] = useState(0)
  return (
    <>
      <h1>設定</h1>
      <section>
        <h2>ユニット学習</h2>
        <UnitStudySettingsForm key={replacedCount} />
      </section>
      <section>
        <h2>表面の表示</h2>
        <DisplaySettingsForm key={replacedCount} />
      </section>
      <section>
        <h2>音声の速さ</h2>
        <PlaybackRateForm key={replacedCount} />
      </section>
      <section>
        <h2>保存状態</h2>
        <StorageStatus />
      </section>
      <section>
        <h2>バックアップ</h2>
        <BackupSection onReplaced={() => setReplacedCount((n) => n + 1)} />
      </section>
    </>
  )
}
