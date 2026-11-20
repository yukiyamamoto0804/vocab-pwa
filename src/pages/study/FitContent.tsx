import { type ReactNode, useLayoutEffect, useRef } from 'react'
import styles from './FitContent.module.css'

/** 1 回に縮める割合 */
const STEP = 0.05
/** 無限に縮め続けないための下限（ここまで縮めても収まらないことは想定していない） */
const MIN_SCALE = 0.3

// 中身を、スクロールさせずに親の大きさに収める。収まらないときは文字を小さくする
// （docs/specs/study-cards.md 2 章）。中身の大きさは em で指定しておくこと。
export function FitContent({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = outer.current
    const content = inner.current
    if (!box || !content) return
    let warned = false

    function shrinkToFit() {
      if (!box || !content) return
      let scale = 1
      content.style.fontSize = '1em'
      while (content.offsetHeight > box.clientHeight && scale > MIN_SCALE) {
        scale -= STEP
        content.style.fontSize = `${scale}em`
      }
      // 画面を回転させるたびに出ないよう、1 枚のカードにつき 1 回だけ知らせる
      if (!warned && content.offsetHeight > box.clientHeight) {
        warned = true
        console.warn(
          '文字を下限まで縮めても収まりませんでした（はみ出した部分は見えません）',
        )
      }
    }

    shrinkToFit()
    // 画面の大きさや中身が変わったら合わせ直す。縮めた結果の大きさは変わらないので、繰り返しにはならない
    const observer = new ResizeObserver(shrinkToFit)
    observer.observe(box)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outer} className={styles.box}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
