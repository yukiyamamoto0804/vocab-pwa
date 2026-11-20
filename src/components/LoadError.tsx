import styles from './LoadError.module.css'

// 端末内のデータを読み込めなかったときの表示
export function LoadError() {
  return (
    <p className={styles.error}>
      端末内の保存領域を読み込めませんでした。プライベートブラウズを使っている場合は、通常のモードで開いてください。
    </p>
  )
}
