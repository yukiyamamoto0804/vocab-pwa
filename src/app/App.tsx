import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ensurePersistentStorage } from '../lib/storage'
import { HomePage } from '../pages/home/HomePage'
import { ImportPage } from '../pages/import/ImportPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { StudyPage } from '../pages/study/StudyPage'
import { UnitsPage } from '../pages/units/UnitsPage'
import { WordsPage } from '../pages/words/WordsPage'
import { Layout } from './Layout'

// 画面と URL の対応は docs/ARCHITECTURE.md 1 章
export function App() {
  useEffect(() => {
    ensurePersistentStorage()
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="packs/:packId" element={<UnitsPage />} />
          <Route path="packs/:packId/units/:unitId" element={<WordsPage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
