import { type DependencyList, useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'done'; value: T }
  | { status: 'error'; error: unknown }

// 画面を開いたときにデータを読み込む。deps が変わったら読み込み直す。
// 画面を離れた後に結果が届いても、状態は更新しない。
export function useAsync<T>(
  load: () => Promise<T>,
  deps: DependencyList,
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })

  // biome-ignore lint/correctness/useExhaustiveDependencies: 読み込み直す条件は呼び出し側が deps で指定する
  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    load()
      .then((value) => {
        if (active) setState({ status: 'done', value })
      })
      .catch((error: unknown) => {
        console.error(error)
        if (active) setState({ status: 'error', error })
      })
    return () => {
      active = false
    }
  }, [...deps])

  return state
}
