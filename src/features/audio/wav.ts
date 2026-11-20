// デコード済みの音声の一部を、WAV（16 ビット PCM・モノラル）のデータにする。
// 区間だけを切り出したデータを <audio> 要素で最後まで鳴らすことで、停止位置がずれないようにする。

const HEADER_BYTES = 44

/**
 * 各チャンネルのサンプル（-1〜1）を平均してモノラルにし、WAV のデータにする。
 * チャンネルの長さは揃っていること
 */
export function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
): ArrayBuffer {
  const length = channels[0]?.length ?? 0
  const dataBytes = length * 2
  const view = new DataView(new ArrayBuffer(HEADER_BYTES + dataBytes))
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1)
      view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeText(0, 'RIFF')
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt チャンクの大きさ
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // チャンネル数
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // 1 秒あたりのバイト数
  view.setUint16(32, 2, true) // 1 サンプルのバイト数
  view.setUint16(34, 16, true) // ビット数
  writeText(36, 'data')
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < length; i += 1) {
    let sum = 0
    for (const channel of channels) sum += channel[i]
    const sample = Math.max(-1, Math.min(1, sum / channels.length))
    view.setInt16(
      HEADER_BYTES + i * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    )
  }
  return view.buffer
}
