import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import styles from './LinkList.module.css'

export interface LinkListItem {
  key: string
  to: string
  title: string
  /** 名前の下に小さく出す補足（語数など） */
  meta?: string
  /** 名前の横に出す短い印（例: 「前回」）。付けた項目は色を変えて目立たせる */
  badge?: string
  /** 項目を押したときに、押した項目の行を渡して呼ぶ（戻ったときに同じ位置へスクロールするため など） */
  onClick?: (row: HTMLElement) => void
  /** 右側に置く、別の画面へ進むボタン（例: 「学習」）。onClick の意味は項目の onClick と同じ */
  action?: { to: string; label: string; onClick?: (row: HTMLElement) => void }
}

/** 押したリンクの行（li）を渡して fn を呼ぶクリックの処理 */
const withRow =
  (fn?: (row: HTMLElement) => void) => (e: MouseEvent<HTMLElement>) => {
    const row = e.currentTarget.closest('li')
    if (row) fn?.(row)
  }

// 押すと次の画面へ進む項目の一覧（パック一覧・ユニット一覧）
export function LinkList({ items }: { items: LinkListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={styles.row} data-key={item.key}>
          <Link
            to={item.to}
            className={`${styles.link} ${item.badge ? styles.marked : ''}`}
            onClick={withRow(item.onClick)}
          >
            <span className={styles.title}>
              {item.title}
              {item.badge && <span className={styles.badge}>{item.badge}</span>}
            </span>
            {item.meta && <span className={styles.meta}>{item.meta}</span>}
          </Link>
          {item.action && (
            <Link
              to={item.action.to}
              className={styles.action}
              onClick={withRow(item.action.onClick)}
            >
              {item.action.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
