import { useEffect, useState } from 'react'
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

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
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
