import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { DB_OUTDATED_EVENT, listenRecordsReplaced } from '../db/database'
import { PAGE_SCROLLER_PROPS } from '../lib/pageScroller'
import styles from './Layout.module.css'

export function Layout() {
  // 画面を移ったら上から表示する。文書（window）はスクロールさせず、画面（URL）ごとに新しいスクロールの箱（main）を
  // 作り直す（key）。新しい箱は必ず上から始まり、前の画面の位置を持ち越さない。
  // 文書の位置を scrollTo で上に戻す作りでは、iPhone の PWA で、前の画面の深い位置が新しい画面の下端に詰められて
  // 当て直され、単語一覧などがいちばん下から始まることがあったため（docs/ARCHITECTURE.md 1 章）。
  // ユニット一覧で元の位置に戻すときは、一覧の画面がこの箱の位置を合わせる
  const { pathname, search } = useLocation()

  /** 新しい版のアプリが DB を更新したか、ほかの画面が学習記録を置き換え、この画面では保存できなくなったか */
  const [outdated, setOutdated] = useState(false)
  useEffect(() => {
    const onOutdated = () => setOutdated(true)
    window.addEventListener(DB_OUTDATED_EVENT, onOutdated)
    const stopListening = listenRecordsReplaced()
    return () => {
      window.removeEventListener(DB_OUTDATED_EVENT, onOutdated)
      stopListening()
    }
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
          ほかの画面で、アプリの更新か学習記録のインポートがありました。保存を続けるため、アプリを開き直してください。
        </p>
      )}
      <main
        key={pathname + search}
        className={styles.scroller}
        {...PAGE_SCROLLER_PROPS}
      >
        <div className={styles.main}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
