import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App.tsx'

// スクロールの位置はアプリが決める（画面を移ったら上から。app/Layout.tsx）。
// ブラウザが戻る操作や再読み込みで自分で位置を戻すと、アプリの処理と取り合いになるため止める
history.scrollRestoration = 'manual'

const root = document.getElementById('root')
if (!root) throw new Error('#root が見つかりません')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
