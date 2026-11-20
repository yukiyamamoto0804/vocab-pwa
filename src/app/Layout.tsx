import { Link, NavLink, Outlet } from 'react-router'
import styles from './Layout.module.css'

export function Layout() {
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
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
