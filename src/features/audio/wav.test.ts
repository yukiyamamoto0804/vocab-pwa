import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

function text(view: DataView, offset: number, length: number): string {
  let result = ''
  for (let i = 0; i < length; i += 1)
    result += String.fromCharCode(view.getUint8(offset + i))
  return result
}

describe('encodeWav', () => {
  it('16 ビット・モノラルの WAV の見出しを書く', () => {
    const view = new DataView(encodeWav([new Float32Array(3)], 44100))
    expect(view.byteLength).toBe(44 + 3 * 2)
    expect(text(view, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(view.byteLength - 8)
    expect(text(view, 8, 8)).toBe('WAVEfmt ')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // モノラル
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(44100 * 2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(text(view, 36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(3 * 2)
  })

  it('サンプルを 16 ビットの整数にし、範囲の外は端に収める', () => {
    const view = new DataView(
      encodeWav([Float32Array.of(0, 1, -1, 2, -2)], 8000),
    )
    const samples = [0, 1, 2, 3, 4].map((i) => view.getInt16(44 + i * 2, true))
    expect(samples).toEqual([0, 32767, -32768, 32767, -32768])
  })

  it('複数のチャンネルは平均してモノラルにする', () => {
    const view = new DataView(
      encodeWav([Float32Array.of(1, 0.5), Float32Array.of(0, -0.5)], 8000),
    )
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getInt16(44, true)).toBe(Math.trunc(0.5 * 0x7fff))
    expect(view.getInt16(46, true)).toBe(0)
  })

  it('長さ 0 でも見出しだけのデータを返す', () => {
    expect(encodeWav([new Float32Array(0)], 8000).byteLength).toBe(44)
  })
})
