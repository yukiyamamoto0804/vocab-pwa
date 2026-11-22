// デモ教材の確かめの設定（docs/specs/demo-pack.md 3 章）

/** 使わない訳語（EJDict-hand の誤字・英語の混ざったものなど）。見つけたら足す */
export const EXCLUDED = new Set([
  '突す刺さる',
  'くっける',
  '好ましてものにする',
  '炭頭台',
  '予算書budget plan予算案',
])

/** 見本に向かない語として飛ばした順位（demo/README.md にも同じものを書く） */
export const SKIPPED_RANKS = []
