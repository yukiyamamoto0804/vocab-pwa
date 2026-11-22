import { StorageStatus } from '../../components/StorageStatus'
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
        <h2>保存状態</h2>
        <StorageStatus />
      </section>
      <section>
        <h2>学習記録のバックアップ</h2>
        <p>エクスポート / インポート（準備中）</p>
      </section>
    </>
  )
}
