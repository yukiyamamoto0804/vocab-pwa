// 学習の設定値（docs/specs/study-cards.md 6 章）。
// 研究上の根拠がない出発点なので、使いながらここで調整する。
export const studyConfig = {
  /** 教材でユニットが指定されていないとき、自動で区切る語数 */
  unitSize: 20,
  /** ユニット学習に混ぜる単語の数の上限（設定画面で変更できる。docs/specs/study-cards.md 7 章） */
  mixCount: { default: 5, min: 0, max: 20 },
  /** テスト・復習の出題数の選択肢（'all' は対象の単語すべて） */
  studyCount: { options: [20, 50, 100, 'all'] },
  /** テストの出題数の初期値 */
  testCount: { default: 50 },
  /** テストの苦手優先で、定着度をこの幅の帯に分け、同じ帯の単語どうしはランダムに並べる */
  testWeakBand: 0.1,
  /** テストの並び順の初期値 */
  testOrder: { default: 'weak' },
  /** 混ぜる単語の対象範囲（直前の何回の学習で忘れた単語か。設定画面で変更できる） */
  mixSessionRange: { default: 3, min: 1, max: 10 },
  /** 復習の対象範囲（直前の何回の学習で忘れた単語か。復習を始めるときに選ぶ） */
  reviewSessionRange: { default: 3, min: 1, max: 20 },
  /** 復習の出題数の初期値（選択肢はテストと同じ） */
  reviewCount: { default: 'all' },
  /** 定着度の指数移動平均で、直近の結果をどれだけ重視するか */
  masteryLambda: 0.4,
  /**
   * 自動で進める学習（docs/specs/study-cards.md 11 章）の待つ時間（ミリ秒）。
   * start は新しいカードを出してから 1 回目を流すまで、gap は 1 回目を流し終えてから裏返して 2 回目を流すまで、
   * wait は 2 回目を流し終えてから「忘れた」にするまで
   */
  autoAdvance: { startMs: 500, gapMs: 500, waitMs: 1000 },
} as const
