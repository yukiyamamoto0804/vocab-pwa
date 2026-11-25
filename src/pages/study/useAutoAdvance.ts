import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { AudioRef, Rating } from '../../db/types'
import {
  AudioFileError,
  playAudio,
  stopAudio,
  unlockAudio,
} from '../../features/audio/player'
import { studyConfig } from '../../features/studyConfig'

// 「単語の音声」を自動で進める（docs/specs/study-cards.md 11 章）。
// 新しいカードを出して少し待ち、表面のまま 1 回目を流し、少しあけて裏返して 2 回目を流す。流し終えてから少し待って、
// 申告がなければ「忘れた」にする。止めている間は、通常の進め方と同じく自分で操作する。

interface Options {
  /** 自動で進める学習か。偽なら何もしない */
  enabled: boolean
  packId: string
  /** 今のカードの単語の音声 */
  audio: AudioRef | undefined
  /** カードが変わるたびに変わる値（申告・取り消しのたびに変わる回答の数） */
  cardKey: number
  flipped: boolean
  flip: () => void
  rate: (rating: Rating) => void
}

/** 申告を待っている回。指を離して待ち直すたびに round が増え、残りの時間の帯を最初から描き直す */
interface Waiting {
  cardKey: number
  round: number
}

export function useAutoAdvance(options: Options) {
  const { enabled, packId, audio, cardKey, flipped } = options
  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [waiting, setWaiting] = useState<Waiting>()
  /** 止めた理由（再生できなかった）と、それがどのカードのものか。カードが変わったら出さない */
  const [error, setError] = useState<{ cardKey: number; message: string }>()
  /** カードに指を置いているか。置いている間は「忘れた」にしない（スワイプの途中で時間が切れないように） */
  const touching = useRef(false)
  /** 指を置いた回数。待っている間に置かれたかを見分ける（置いて、待ちが終わる前に離したときも待ち直すため） */
  const touchCount = useRef(0)
  /** 指を離したときに知らせる先（待っている処理があるときだけ） */
  const onRelease = useRef<(() => void) | undefined>(undefined)

  // 待っている間に描き直されても、最新の処理（申告は最新の状態で行う）を呼ぶ
  const flipCard = useEffectEvent(() => options.flip())
  const rateForgot = useEffectEvent(() => options.rate('forgot'))

  useEffect(() => {
    if (!enabled || !running || !audio) return
    let cancelled = false
    const timers: number[] = []
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms))
      })
    const released = () =>
      new Promise<void>((resolve) => {
        onRelease.current = resolve
      })
    const { startMs, gapMs, waitMs } = studyConfig.autoAdvance
    ;(async () => {
      try {
        if (!flipped) {
          // 申告してすぐ次の音声が流れると慌ただしいので、カードを出してから少し待つ
          await wait(startMs)
          if (cancelled) return
          setError(undefined)
          await playAudio(packId, audio)
          if (cancelled) return
          await wait(gapMs)
          // 裏返すと、この処理をやめて 2 回目から始め直す（表面をタップして先に裏返したときも同じ）
          if (!cancelled) flipCard()
          return
        }
        setError(undefined)
        await playAudio(packId, audio)
        for (let round = 0; ; round += 1) {
          if (cancelled) return
          // 指を置いている間は待ち始めず、離してから待つ
          if (touching.current) {
            setWaiting(undefined)
            await released()
            continue
          }
          const count = touchCount.current
          setWaiting({ cardKey, round })
          await wait(waitMs)
          if (cancelled) return
          // 待っている間に指を置いていなければ「忘れた」にする。置いていたら、離してから改めて待つ
          if (touchCount.current === count) break
        }
        rateForgot()
      } catch (e) {
        if (cancelled) return
        // 鳴らせなかったときは「忘れた」にせず止める。
        // 端末が止めたときの「もう一度押してください」は、ここでは「再開」と紛らわしいので使わない
        console.error(e)
        setRunning(false)
        setError({
          cardKey,
          message:
            e instanceof AudioFileError
              ? e.userMessage
              : '音声を再生できませんでした',
        })
      }
    })()
    // 音声はここでは止めない（止めた後に押した再生ボタンの音まで止めてしまうため）。
    // 止めるときは pause、次のカードに進むときは申告の処理が止める
    return () => {
      cancelled = true
      for (const timer of timers) clearTimeout(timer)
      // 指を離すのを待っている処理も終わらせる（cancelled を見て抜ける）
      onRelease.current?.()
      onRelease.current = undefined
      setWaiting(undefined)
    }
  }, [enabled, running, packId, audio, cardKey, flipped])

  // アプリを離れたら止める（戻ったときに、聞いていない間に「忘れた」が付かないように）
  useEffect(() => {
    if (!enabled) return
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAudio()
        setRunning(false)
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [enabled])

  /** 進め始める・再開する。ボタンを押したときの処理から直接呼ぶこと（iOS の自動再生の制限のため） */
  function start() {
    unlockAudio()
    setError(undefined)
    setStarted(true)
    setRunning(true)
  }

  /** 止める。流している音声も止める */
  function pause() {
    if (!running) return
    stopAudio()
    setRunning(false)
  }

  /** 止める。音声は止めない（裏面の再生ボタンを押したときなど、続けて鳴らすとき） */
  function hold() {
    setRunning(false)
  }

  /** カードに指を置いた・離したことを知らせる（StudyCard の onTouchChange） */
  function touch(active: boolean) {
    touching.current = active
    if (active) {
      touchCount.current += 1
      setWaiting(undefined)
    } else {
      const release = onRelease.current
      onRelease.current = undefined
      release?.()
    }
  }

  const isRunning = enabled && running
  return {
    running: isRunning,
    started,
    /** 申告を待っている回（残りの時間の帯を出す）。待っていなければ undefined */
    waiting:
      isRunning && waiting?.cardKey === cardKey ? waiting.round : undefined,
    error: error?.cardKey === cardKey ? error.message : undefined,
    start,
    pause,
    hold,
    touch,
  }
}
