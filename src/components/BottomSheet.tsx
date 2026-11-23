import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from 'react'
import { pageScrollerOf } from '../lib/pageScroller'
import styles from './BottomSheet.module.css'

interface Props {
  /** 閉じられたとき（✕・背景・Esc）に呼ぶ */
  onClose: () => void
  /** 見出し */
  title: string
  /** false の間は、✕・背景・Esc で閉じられないようにする（処理の途中など）。省略すると閉じられる */
  closable?: boolean
  children: ReactNode
}

// 画面の下から出すシート（テスト・復習の条件を選ぶときなど）。
// 置いている間だけ開く。閉じられたら onClose で呼び出し側が外す
export function BottomSheet({
  onClose,
  title,
  closable = true,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  /** 押し始めた位置が背景だったか（シートの中で押し始めて背景で離したときは閉じない） */
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // iOS では、背景をスワイプすると裏の一覧がスクロールしてしまうため、開いている間は止める。
    // スクロールするのは画面の中身の箱（app/Layout.tsx）なので、その箱を止める
    const scroller = pageScrollerOf(dialog)
    if (scroller) scroller.style.overflow = 'hidden'
    return () => {
      if (scroller) scroller.style.overflow = ''
      dialog.close()
    }
  }, [])

  const close = () => {
    if (closable) dialogRef.current?.close()
  }
  const isBackdrop = (e: SyntheticEvent) => e.target === e.currentTarget

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: キーボードでは Esc で閉じられる（dialog の標準の動作）
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      // close イベントは後から届くため、その間に開き直していたら（開発時の StrictMode など）無視する
      onClose={() => {
        if (!dialogRef.current?.open) onClose()
      }}
      // Esc で閉じるのを、閉じられない間は止める
      onCancel={(e) => {
        if (!closable) e.preventDefault()
      }}
      // 背景（シートの外）を押したら閉じる
      onPointerDown={(e) => {
        pressedBackdrop.current = isBackdrop(e)
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && isBackdrop(e)) close()
      }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            disabled={!closable}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
