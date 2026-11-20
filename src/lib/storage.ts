// 端末内の教材・学習記録がブラウザに自動削除されないよう、永続化を要求する。
// 戻り値は永続化されているかどうか。
export async function requestPersistentStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false
  if (await storage.persisted()) return true
  return storage.persist()
}

let persistentStorage: Promise<boolean> | undefined

// 起動処理と各画面から呼ぶ。要求は 1 回だけ行い、結果を共有する。
// 要求自体が失敗した場合は、永続化されていないとみなす。
export function ensurePersistentStorage(): Promise<boolean> {
  persistentStorage ??= requestPersistentStorage().catch(() => false)
  return persistentStorage
}
