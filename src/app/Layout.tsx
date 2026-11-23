import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { DB_OUTDATED_EVENT, listenRecordsReplaced } from '../db/database'
import styles from './Layout.module.css'

export function Layout() {
  // 画面を移ったら上から表示する。前の画面のスクロール位置が残ると、新しい画面の中身が揃うまでに
  // ブラウザが位置を詰めるかどうかで、下のほうから始まることがあるため。
  // ユニット一覧で元の位置に戻すときは、一覧を読み終えた後（この処理より後）に、一覧の画面が合わせる
  const { pathname, search } = useLocation()
  // biome-ignore lint/correctness/useExhaustiveDependencies: 画面（URL）が変わったときだけ上に戻す
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname, search])

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
          ほかの画面で、アプリの更新か学習記録のインポートがありました。保存を続けるため、アプリを開き直してください。
        </p>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
