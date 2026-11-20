import { Link } from 'react-router'
import styles from './LinkList.module.css'

export interface LinkListItem {
  key: string
  to: string
  title: string
  /** 名前の下に小さく出す補足（語数など） */
  meta?: string
}

// 押すと次の画面へ進む項目の一覧（パック一覧・ユニット一覧）
export function LinkList({ items }: { items: LinkListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to} className={styles.link}>
            <span className={styles.title}>{item.title}</span>
            {item.meta && <span className={styles.meta}>{item.meta}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
