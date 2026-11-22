import { describe, expect, it } from 'vitest'
import { linkify } from './linkify'

describe('linkify', () => {
  it('https・http の URL だけをリンクにする', () => {
    expect(
      linkify('出典 https://example.com/a と javascript:alert(1) と ftp://x'),
    ).toEqual([
      { text: '出典 ' },
      { text: 'https://example.com/a', href: 'https://example.com/a' },
      { text: ' と javascript:alert(1) と ftp://x' },
    ])
  })

  it('括弧・読点・句点の手前で切り、末尾の「.」「,」は含めない', () => {
    expect(
      linkify('(https://example.org/by-sa/4.0/). 続き（http://example.net）。'),
    ).toEqual([
      { text: '(' },
      {
        text: 'https://example.org/by-sa/4.0/',
        href: 'https://example.org/by-sa/4.0/',
      },
      { text: '). 続き（' },
      { text: 'http://example.net', href: 'http://example.net' },
      { text: '）。' },
    ])
  })

  it('ドメインの中の「.」は切らない', () => {
    expect(linkify('https://www.example.com/list, next')[0]).toEqual({
      text: 'https://www.example.com/list',
      href: 'https://www.example.com/list',
    })
  })

  it('空白（全角を含む）と読点の手前で切り、1 文の中の複数の URL を見つける', () => {
    expect(
      linkify('a https://x.example/1、https://y.example/2\u3000次'),
    ).toEqual([
      { text: 'a ' },
      { text: 'https://x.example/1', href: 'https://x.example/1' },
      { text: '、' },
      { text: 'https://y.example/2', href: 'https://y.example/2' },
      { text: '\u3000次' },
    ])
  })

  it('URL がなければ文をそのまま返す', () => {
    expect(linkify('出典なし')).toEqual([{ text: '出典なし' }])
    expect(linkify('')).toEqual([])
  })
})
