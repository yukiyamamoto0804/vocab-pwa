import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  getPlaybackRate: vi.fn(),
  savePlaybackRate: vi.fn(),
}))
vi.mock('../../db/settings', () => db)

/** 外から解決・失敗させられる Promise */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// 今の値をモジュールの中に持つので、テストごとに読み込み直す
async function load() {
  vi.resetModules()
  return import('./playbackRate')
}

beforeEach(() => {
  db.getPlaybackRate.mockReset()
  db.savePlaybackRate.mockReset()
})

describe('playbackRate', () => {
  it('読み込みを待つ間に選び直されたら、読み込んだ古い値で上書きしない', async () => {
    const m = await load()
    const read = deferred<number>()
    db.getPlaybackRate.mockReturnValue(read.promise)
    db.savePlaybackRate.mockResolvedValue(undefined)
    const loading = m.loadPlaybackRate()
    await m.changePlaybackRate(0.8)
    read.resolve(1.2)
    expect(await loading).toBe(0.8)
    expect(m.currentPlaybackRate()).toBe(0.8)
  })

  it('続けて保存し両方とも失敗したら、最後に保存できた値に戻す', async () => {
    const m = await load()
    db.getPlaybackRate.mockResolvedValue(1.1)
    await m.loadPlaybackRate()
    const first = deferred<void>()
    const second = deferred<void>()
    db.savePlaybackRate
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const a = m.changePlaybackRate(0.8)
    const b = m.changePlaybackRate(0.9)
    first.reject(new Error('A'))
    // 最新ではない保存の失敗は返さない
    await expect(a).resolves.toBeUndefined()
    expect(m.currentPlaybackRate()).toBe(0.9)
    second.reject(new Error('B'))
    await expect(b).rejects.toThrow('B')
    expect(m.currentPlaybackRate()).toBe(1.1)
  })

  it('保存できた値を、後の失敗の戻し先にする', async () => {
    const m = await load()
    db.savePlaybackRate.mockResolvedValueOnce(undefined)
    await m.changePlaybackRate(1.2)
    db.savePlaybackRate.mockRejectedValueOnce(new Error('x'))
    await expect(m.changePlaybackRate(0.8)).rejects.toThrow('x')
    expect(m.currentPlaybackRate()).toBe(1.2)
  })
})
