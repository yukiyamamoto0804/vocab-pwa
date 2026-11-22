import styles from './Loading.module.css'

// 読み込み中の表示。古い端末や大きい教材で時間がかかるとき、止まったのか読み込み中なのか分かるようにする
export function Loading() {
  return (
    <p className={styles.loading} role="status">
      読み込んでいます…
    </p>
  )
}
