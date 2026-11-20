import { Link } from 'react-router'
import styles from './LinkList.module.css'

export interface LinkListItem {
  key: string
  to: string
  title: string
  /** 名前の下に小さく出す補足（語数など） */
  meta?: string
  /** 右側に置く、別の画面へ進むボタン（例: 「学習」） */
  action?: { to: string; label: string }
}

// 押すと次の画面へ進む項目の一覧（パック一覧・ユニット一覧）
export function LinkList({ items }: { items: LinkListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key} className={styles.row}>
          <Link to={item.to} className={styles.link}>
            <span className={styles.title}>{item.title}</span>
            {item.meta && <span className={styles.meta}>{item.meta}</span>}
          </Link>
          {item.action && (
            <Link to={item.action.to} className={styles.action}>
              {item.action.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}
