import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from 'react'
import styles from './BottomSheet.module.css'

interface Props {
  /** 閉じられたとき（✕・背景・Esc）に呼ぶ */
  onClose: () => void
  /** 見出し */
  title: string
  children: ReactNode
}

// 画面の下から出すシート（テスト・復習の条件を選ぶときなど）。
// 置いている間だけ開く。閉じられたら onClose で呼び出し側が外す
export function BottomSheet({ onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  /** 押し始めた位置が背景だったか（シートの中で押し始めて背景で離したときは閉じない） */
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // iOS では、背景をスワイプすると裏の一覧がスクロールしてしまうため、開いている間は止める
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
      dialog.close()
    }
  }, [])

  const close = () => dialogRef.current?.close()
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
