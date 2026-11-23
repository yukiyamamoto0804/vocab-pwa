/**
 * 学習画面（と、学習を始める前に出す画面）からユニット一覧へ戻るリンクに付ける state。
 * ユニット一覧（pages/units/UnitsPage.tsx）は、これがあるときだけ、学習を始めたときの位置にスクロールする
 * （docs/specs/study-cards.md 6 章「前回学習したユニットの表示」）
 */
export const RETURN_FROM_STUDY = { returnFromStudy: true } as const
