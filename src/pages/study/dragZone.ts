import type { Rating } from '../../db/types'

// カードを動かした向きと距離から、離したときの申告を決める（docs/specs/study-cards.md 5 章）。
// 左寄りは「忘れた」、右寄りは「覚えた」、ほぼ真上は「曖昧」。
// 「曖昧」と左右の間には、どれにもならない隙間を設けて、迷う向きで誤って申告しないようにする。
// 動かした距離が足りないとき・隙間・真下に近いときは null（カードは元に戻る）。

/** これ以上動かすと申告の対象になる（px） */
const DRAG_THRESHOLD = 100

// 角度は、真上を 0° として左右どちらかに何度傾いているか
/** 0°〜この角度を「曖昧」とみなす */
const UNSURE_MAX = 35
/** この範囲を「忘れた」（左）「覚えた」（右）とみなす。UNSURE_MAX との間は隙間 */
const SIDE_MIN = 55
const SIDE_MAX = 140

export function ratingForDrag(dx: number, dy: number): Rating | null {
  if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return null
  const angle = (Math.atan2(Math.abs(dx), -dy) * 180) / Math.PI
  if (angle <= UNSURE_MAX) return 'unsure'
  if (angle >= SIDE_MIN && angle <= SIDE_MAX)
    return dx < 0 ? 'forgot' : 'remembered'
  return null
}
