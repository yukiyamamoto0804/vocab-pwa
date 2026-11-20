import { describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './storage'

function fakeStorage(persisted: boolean, grant: boolean) {
  return {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => grant),
  } as unknown as StorageManager
}

describe('requestPersistentStorage', () => {
  it('Storage API がない環境では false を返す', async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false)
  })

  it('すでに永続化されていれば、改めて要求しない', async () => {
    const storage = fakeStorage(true, false)
    expect(await requestPersistentStorage(storage)).toBe(true)
    expect(storage.persist).not.toHaveBeenCalled()
  })

  it('永続化されていなければ要求し、その結果を返す', async () => {
    expect(await requestPersistentStorage(fakeStorage(false, true))).toBe(true)
    expect(await requestPersistentStorage(fakeStorage(false, false))).toBe(
      false,
    )
  })
})
