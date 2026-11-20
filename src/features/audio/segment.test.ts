import { describe, expect, it } from 'vitest'
import { resolveSegment } from './segment'

describe('resolveSegment', () => {
  it('開始秒〜終了秒を、開始位置と長さにする', () => {
    expect(resolveSegment({ file: 'a.mp3', start: 2, end: 3.5 }, 10)).toEqual({
      offset: 2,
      duration: 1.5,
    })
  })

  it('省略した開始・終了は、ファイルの先頭・末尾とみなす', () => {
    expect(resolveSegment({ file: 'a.mp3' }, 10)).toEqual({
      offset: 0,
      duration: 10,
    })
    expect(resolveSegment({ file: 'a.mp3', start: 4 }, 10)).toEqual({
      offset: 4,
      duration: 6,
    })
  })

  it('終了がファイルの長さを超えるときは、末尾までにする', () => {
    expect(resolveSegment({ file: 'a.mp3', start: 8, end: 12 }, 10)).toEqual({
      offset: 8,
      duration: 2,
    })
  })

  it('開始がファイルの長さ以上なら null', () => {
    expect(resolveSegment({ file: 'a.mp3', start: 10 }, 10)).toBeNull()
  })
})
