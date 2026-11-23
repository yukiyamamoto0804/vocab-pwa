// ユニット一覧で行（単語一覧へ進む）や「学習」を押したときの、その行の画面上の高さ
// （docs/specs/study-cards.md 6 章「前回学習したユニットの表示」）。
// 学習画面・単語一覧からユニット一覧に戻ったとき、同じ行が同じ高さに来るようにスクロールするために使う。
// アプリの中を移るあいだだけ覚えておけばよいので、ブラウザの保存領域には書かない（開き直したら上から出す）

interface UnitRowPosition {
  packId: string
  unitId: number
  /** 行の上端の、画面の上端からの距離（px） */
  top: number
}

let remembered: UnitRowPosition | undefined

export function rememberUnitRow(position: UnitRowPosition): void {
  remembered = position
}

/** そのパックの覚えた位置を取り出して忘れる（ほかの経路で一覧を開いたときに使わないように） */
export function takeUnitRow(
  packId: string,
): Omit<UnitRowPosition, 'packId'> | undefined {
  const position = remembered
  remembered = undefined
  return position?.packId === packId ? position : undefined
}
