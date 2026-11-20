/** 0 以上 1 未満の乱数を返す関数。テストでは固定の値を返すものに差し替える */
export type Random = () => number

/** 並びをランダムに入れ替えた新しい配列を返す（Fisher–Yates） */
export function shuffle<T>(
  items: readonly T[],
  random: Random = Math.random,
): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
