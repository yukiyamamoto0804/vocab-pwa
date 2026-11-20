import { describe, expect, it } from 'vitest'
import { isQuotaError } from './errors'

describe('isQuotaError', () => {
  const quota = () => {
    const e = new Error('quota')
    e.name = 'QuotaExceededError'
    return e
  }

  it('容量不足そのものと、Dexie が包んだ容量不足を見分ける', () => {
    expect(isQuotaError(quota())).toBe(true)
    expect(
      isQuotaError(Object.assign(new Error('abort'), { inner: quota() })),
    ).toBe(true)
    expect(
      isQuotaError(
        Object.assign(new Error('bulk'), {
          failures: [new Error('x'), quota()],
        }),
      ),
    ).toBe(true)
  })

  it('ほかの失敗は容量不足とみなさない', () => {
    expect(isQuotaError(new Error('other'))).toBe(false)
    expect(isQuotaError('QuotaExceededError')).toBe(false)
  })
})
