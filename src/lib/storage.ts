// 端末内の教材・学習記録がブラウザに自動削除されないよう、永続化を要求する。
// 戻り値は永続化されているかどうか。
export async function requestPersistentStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false
  if (await storage.persisted()) return true
  return storage.persist()
}
