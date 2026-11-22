import { StorageStatus } from '../../components/StorageStatus'
import { BackupSection } from './BackupSection'
import { DisplaySettingsForm } from './DisplaySettingsForm'
import { UnitStudySettingsForm } from './UnitStudySettingsForm'

export function SettingsPage() {
  return (
    <>
      <h1>設定</h1>
      <section>
        <h2>ユニット学習</h2>
        <UnitStudySettingsForm />
      </section>
      <section>
        <h2>表面の表示</h2>
        <DisplaySettingsForm />
      </section>
      <section>
        <h2>保存状態</h2>
        <StorageStatus />
      </section>
      <section>
        <h2>バックアップ</h2>
        <BackupSection />
      </section>
    </>
  )
}
