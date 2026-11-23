// 画面の中身をスクロールする箱（app/Layout.tsx の main）の目印。
// 文書（window）はスクロールさせず、画面ごとに新しい箱を作ってその中をスクロールする（docs/ARCHITECTURE.md 1 章）。
// 位置を合わせる画面（ユニット一覧）や、背景のスクロールを止める部品（シート）が箱を探すのに使うので、ここに置く

const ATTRIBUTE = 'data-page-scroller'

/** 箱に付ける属性 */
export const PAGE_SCROLLER_PROPS = { [ATTRIBUTE]: '' }

/** el を含む、画面の中身をスクロールする箱。箱の外にあれば null */
export function pageScrollerOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>(`[${ATTRIBUTE}]`)
}
