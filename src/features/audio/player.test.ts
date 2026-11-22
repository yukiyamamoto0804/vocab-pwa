import { describe, expect, it } from 'vitest'
import { toMono } from './player'

describe('toMono', () => {
  const buffer = (channels: number[][]) => ({
    numberOfChannels: channels.length,
    length: channels[0].length,
    getChannelData: (c: number) => Float32Array.from(channels[c]),
  })

  it('モノラルはそのまま返す', () => {
    expect([...toMono(buffer([[0.5, -0.5]]))]).toEqual([0.5, -0.5])
  })

  it('複数のチャンネルは平均してまとめる', () => {
    expect([
      ...toMono(
        buffer([
          [1, 0],
          [0, 0.5],
        ]),
      ),
    ]).toEqual([0.5, 0.25])
  })
})
