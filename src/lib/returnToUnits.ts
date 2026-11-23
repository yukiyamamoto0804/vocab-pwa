// ユニット一覧へ戻るリンクに付ける印（location の state）。学習画面・単語一覧から戻るときに付ける。
// ユニット一覧は、これがあるときだけ、行を押したときの位置にスクロールする
// （docs/specs/study-cards.md 6 章「前回学習したユニットの表示」）。
// 複数の画面で使い、画面同士は import しない（docs/ARCHITECTURE.md 3 章）ので、ここに置く

export const RETURN_TO_UNITS = { returnToUnits: true } as const

/** location の state が、ユニット一覧へ戻る印か */
export function isReturnToUnits(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'returnToUnits' in state &&
    state.returnToUnits === true
  )
}
