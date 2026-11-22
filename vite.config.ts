/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { demoPack } from './scripts/build/demoPack.ts'

// https://vite.dev/config/
export default defineConfig({
  // 配信先のパスに依存しないよう、相対パスでビルドする
  base: './',
  plugins: [
    react(),
    // デモ教材（demo/）を zip にして配信物に入れる（docs/specs/demo-pack.md 5 章）。
    // zip は Service Worker で前もってキャッシュしない（下の VitePWA の既定の対象は js・css・html とアイコンだけ）
    demoPack(fileURLToPath(new URL('./demo', import.meta.url))),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '単語帳',
        short_name: '単語帳',
        description: '自分で用意した教材を取り込んで学習する単語帳',
        lang: 'ja',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
