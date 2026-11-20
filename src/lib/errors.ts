// 端末の保存容量が足りないことによる失敗か。
// Dexie はトランザクションの中止（AbortError の inner）や、まとめて書き込んだときの失敗
// （BulkError の failures）に包んで届けることがあるため、中まで調べる
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e.name === 'QuotaExceededError') return true
  const { inner, failures } = e as { inner?: unknown; failures?: unknown }
  return (
    isQuotaError(inner) ||
    (Array.isArray(failures) && failures.some(isQuotaError))
  )
}
