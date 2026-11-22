import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { DB_OUTDATED_EVENT } from '../db/database'
import styles from './Layout.module.css'

export function Layout() {
  /** 新しい版のアプリが DB を更新し、この画面では保存できなくなったか */
  const [outdated, setOutdated] = useState(false)
  useEffect(() => {
    const onOutdated = () => setOutdated(true)
    window.addEventListener(DB_OUTDATED_EVENT, onOutdated)
    return () => window.removeEventListener(DB_OUTDATED_EVENT, onOutdated)
  }, [])

  // 画面の上に固定する部品（ユニット一覧の表面の種類など）を、ヘッダーのすぐ下に置けるよう、ヘッダーの高さを CSS 変数で渡す。
  // 高さは端末の上部の余白（ノッチなど）や文字の大きさで変わるため、測って決める
  const layoutRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const header = headerRef.current
    const layout = layoutRef.current
    if (!header || !layout || typeof ResizeObserver === 'undefined') return
    const update = () =>
      layout.style.setProperty(
        '--header-height',
        // 小数を切り捨て、固定した部品とヘッダーの間に隙間ができないようにする（重なる分はヘッダーが手前に出る）
        `${Math.floor(header.getBoundingClientRect().height)}px`,
      )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={layoutRef} className={styles.layout}>
      <header ref={headerRef} className={styles.header}>
        <Link to="/" className={styles.appName}>
          単語帳
        </Link>
        <nav className={styles.nav}>
          <NavLink to="/import">取り込み</NavLink>
          <NavLink to="/settings">設定</NavLink>
        </nav>
      </header>
      {outdated && (
        <p className={styles.outdated} role="alert">
          アプリが新しい版に更新されました。保存を続けるため、アプリを開き直してください。
        </p>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
