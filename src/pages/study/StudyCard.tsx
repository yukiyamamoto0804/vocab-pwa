import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'
import type { Rating } from '../../db/types'
import { ratingForDrag } from './dragZone'
import { RATING_LABELS } from './ratingLabels'
import styles from './StudyCard.module.css'

// 学習のカード（docs/specs/study-cards.md 5 章「学習画面の操作」）。
// 表面をタップすると裏返る。裏面は指で自由に動かせ、動かした向きに応じて
// 画面の上に「忘れた」「曖昧」「覚えた」が出る。出ている状態で離すとその申告になり、
// 何も出ていなければ元の位置に戻る。
// data-no-flip を付けた要素（再生ボタンの帯など）の中で指を置いたときは、裏返さない。

/** これ以上指が動いたら、タップではなくドラッグとみなす（px） */
const TAP_SLOP = 10

/** 画面の上に出すラベルの並び（左から） */
const ZONES: Rating[] = ['forgot', 'unsure', 'remembered']

interface Props {
  flipped: boolean
  front: ReactNode
  back: ReactNode
  onFlip: () => void
  onRate: (rating: Rating) => void
}

interface Gesture {
  pointerId: number
  x: number
  y: number
  /** 最後に指が動いたときの、置いた位置からの差分。画面のラベルと離したときの申告を一致させる */
  dx: number
  dy: number
  /** 裏返さない領域の中で指を置いたか */
  inNoFlip: boolean
  /** タップとみなせる範囲を超えて動いたか */
  moved: boolean
}

function isInNoFlip(target: EventTarget): boolean {
  return target instanceof Element && target.closest('[data-no-flip]') !== null
}

export function StudyCard({ flipped, front, back, onFlip, onRate }: Props) {
  const gesture = useRef<Gesture | null>(null)
  /** 直前に指を離した操作。click で裏返すかどうかの判定に使う */
  const lastGesture = useRef<Gesture | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // 2 本目の指は無視する（1 本目の指の操作を上書きして、カードがずれたまま止まらないように）
    if (!e.isPrimary) return
    gesture.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dx: 0,
      dy: 0,
      inNoFlip: isInNoFlip(e.target),
      moved: false,
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    // マウスのボタンがもう離されている（離したことが届かなかった）なら、ここで離したことにする
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      release(e.pointerId)
      return
    }
    const x = e.clientX - g.x
    const y = e.clientY - g.y
    g.dx = x
    g.dy = y
    if (!g.moved && Math.hypot(x, y) > TAP_SLOP) {
      g.moved = true
      if (flipped) e.currentTarget.setPointerCapture(e.pointerId)
    }
    // 裏面だけ、カードを指に合わせて動かす
    if (flipped && g.moved) setOffset({ x, y })
  }

  /** 指を離したときの処理。離したときに申告が出ていれば、その申告にする */
  function release(pointerId: number) {
    const g = gesture.current
    if (!g || g.pointerId !== pointerId) return
    gesture.current = null
    lastGesture.current = g
    setOffset({ x: 0, y: 0 })
    if (!flipped || !g.moved) return
    const rating = ratingForDrag(g.dx, g.dy)
    if (rating) onRate(rating)
  }

  /** 操作を取り消す。カードは元の位置に戻し、申告しない */
  function cancel() {
    if (!gesture.current) return
    gesture.current = null
    lastGesture.current = null
    setOffset({ x: 0, y: 0 })
  }

  function handlePointerCancel(e: PointerEvent<HTMLDivElement>) {
    // 無視している 2 本目の指の取り消しでは、1 本目の操作を止めない
    if (!e.isPrimary) return
    cancel()
  }

  // カードの外やブラウザの外で離したときも、離したことを受け取る（カードが指に付いたまま残らないように）。
  // カードの上で離したときは、カードの onPointerUp で済ませた後なので何もしない
  const onWindowPointerUp = useEffectEvent((e: globalThis.PointerEvent) =>
    release(e.pointerId),
  )
  const onWindowPointerCancel = useEffectEvent((e: globalThis.PointerEvent) => {
    if (e.isPrimary) cancel()
  })
  // ほかのウィンドウに移ったら、離したことが届かないことがあるので取り消す
  const onWindowBlur = useEffectEvent(() => cancel())
  useEffect(() => {
    const up = (e: globalThis.PointerEvent) => onWindowPointerUp(e)
    const cancelled = (e: globalThis.PointerEvent) => onWindowPointerCancel(e)
    const blur = () => onWindowBlur()
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancelled)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancelled)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // 裏返すのは click で行う。指を離した時点（pointerup）で裏面に描き替えると、
  // 同じタップの click が裏面の同じ位置にあるボタン（報告など）に届いてしまうため
  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const g = lastGesture.current
    lastGesture.current = null
    // 指を置いた位置（帯の端に置いて外で離した場合）と、click が起きた要素
    // （キーボードで再生ボタンを押した場合）の、どちらかが裏返さない領域なら裏返さない
    const inNoFlip = g?.inNoFlip || isInNoFlip(e.target)
    if (!flipped && !g?.moved && !inNoFlip) onFlip()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (flipped || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onFlip()
    }
  }

  const { x, y } = offset
  const dragging = x !== 0 || y !== 0
  const activeRating = dragging ? ratingForDrag(x, y) : null

  return (
    <div className={styles.stage}>
      <div
        className={styles.frame}
        style={{
          transform: dragging
            ? `translate(${x}px, ${y}px) rotate(${x / 25}deg)`
            : undefined,
        }}
        data-dragging={dragging}
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: ドラッグも受け付けるため button にはできない。表面では role と tabIndex を付ける */}
        <div
          className={styles.card}
          data-flipped={flipped}
          data-rating={activeRating ?? undefined}
          role={flipped ? undefined : 'button'}
          tabIndex={flipped ? undefined : 0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => release(e.pointerId)}
          onPointerCancel={handlePointerCancel}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          {flipped ? back : front}
        </div>
      </div>
      {/* 離すとどの申告になるかを、カードの動きに関係なく画面の上の決まった位置に出す */}
      <div className={styles.zones} aria-hidden="true">
        {ZONES.map((rating) => (
          <span
            key={rating}
            className={styles.zone}
            data-rating={rating}
            data-active={rating === activeRating}
          >
            {RATING_LABELS[rating]}
          </span>
        ))}
      </div>
    </div>
  )
}
