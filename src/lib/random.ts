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

/**
 * ランダムな ID（UUID v4 の形）を返す。
 * crypto.randomUUID は https などの安全な接続でしか使えないため、
 * 同じ Wi-Fi の端末から http で開いて試すときは crypto.getRandomValues で作る
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // バージョン 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // バリアント
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
