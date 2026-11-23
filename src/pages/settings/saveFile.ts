// 作ったファイルを端末に保存する（docs/specs/backup.md 5 章）。
// 共有の画面に渡せればそれを開き、保存先は利用者が選ぶ。渡せない・共有の画面が断ったときはダウンロードにする。
// 共有の画面は、利用者が押した直後でないと開けないため、ボタンを押したときに呼ぶ

/** shared: 共有の画面で共有した。downloaded: ダウンロードを始めた。canceled: 共有の画面を閉じた */
export type SaveFileResult = 'shared' | 'downloaded' | 'canceled'

export async function saveFile(file: File): Promise<SaveFileResult> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError')
        return 'canceled'
      // canShare が渡せると答えても、共有の画面が断ることがある（PC の Safari など）。
      // そのときはダウンロードに切り替える
      console.warn('共有の画面に渡せなかったため、ダウンロードにします', e)
    }
  }
  download(file)
  return 'downloaded'
}

/** 複数のファイルを、まとめて 1 回で共有の画面に渡せるか */
export function canShareFiles(files: File[]): boolean {
  return navigator.canShare?.({ files }) ?? false
}

/**
 * 複数のファイルを、まとめて共有の画面に渡す（canShareFiles で確かめてから呼ぶ）。
 * ブラウザは続けて複数のファイルをダウンロードさせると止めることがあるので、ダウンロードへの切り替えはしない
 */
export async function shareFiles(
  files: File[],
): Promise<'shared' | 'canceled'> {
  try {
    await navigator.share({ files })
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'canceled'
    throw e
  }
}

/** ダウンロードを始めるまでの猶予。すぐに URL を捨てると、ブラウザによっては保存が始まらない */
const REVOKE_DELAY_MS = 60_000

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
