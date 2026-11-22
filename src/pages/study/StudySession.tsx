import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Explanation } from '../../components/Explanation'
import { PlayButton, type PlayButtonSize } from '../../components/PlayButton'
import { restoreBeforeAnswer, saveAnswer, toggleReport } from '../../db/study'
import type {
  Face,
  ItemRecord,
  ProgressRecord,
  Rating,
  StudyMode,
  StudySessionRecord,
} from '../../db/types'
import { playAudio, stopAudio } from '../../features/audio/player'
import { applyAnswer } from '../../features/mastery/mastery'
import {
  answerCard,
  createDeck,
  currentCard,
  type Deck,
  isFinished,
} from '../../features/session/deck'
import {
  appendAnswer,
  createSessionRecord,
} from '../../features/session/sessionRecord'
import { isQuotaError } from '../../lib/errors'
import { randomId } from '../../lib/random'
import { FitContent } from './FitContent'
import { RATING_LABELS } from './ratingLabels'
import { StudyCard } from './StudyCard'
import styles from './StudySession.module.css'

type Counts = Record<Rating, number>

/** 1 回の学習の状態。直前の申告を取り消すときは、丸ごと 1 つ前に戻す */
interface State {
  deck: Deck
  session: StudySessionRecord
  progress: Map<string, ProgressRecord>
  counts: Counts
}

interface Props {
  packId: string
  mode: StudyMode
  face: Face
  /** 出す順に並べた単語 */
  items: ItemRecord[]
  initialProgress: Map<string, ProgressRecord>
  initialReported: Set<string>
  exitPath: string
  /** 回答を保存するたびに呼ぶ */
  onAnswered?: () => void
  /** 最初のカードの上に出すお知らせ（表面に必要なデータがなくて出さない単語があるときなど） */
  notice?: string
}

export function StudySession(props: Props) {
  const { packId, mode, face, items, exitPath, onAnswered, notice } = props
  const [state, setState] = useState<State>(() => ({
    deck: createDeck(items.map((i) => i.id)),
    session: createSessionRecord({
      id: randomId(),
      packId,
      mode,
      face,
      startedAt: Date.now(),
    }),
    progress: props.initialProgress,
    counts: { remembered: 0, unsure: 0, forgot: 0 },
  }))
  const [previous, setPrevious] = useState<State | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [reported, setReported] = useState(props.initialReported)
  const [busy, setBusy] = useState(false)
  /** 保存の失敗。容量不足なら 'quota' */
  const [saveError, setSaveError] = useState<'quota' | 'other' | null>(null)

  // 画面を離れたら、再生中の音声を止める
  useEffect(() => stopAudio, [])

  const itemId = currentCard(state.deck)
  const item = items.find((i) => i.id === itemId)

  async function answer(rating: Rating) {
    if (!flipped || busy || !item) return
    const at = Date.now()
    const progress = applyAnswer(state.progress.get(item.id), {
      packId,
      itemId: item.id,
      face,
      rating,
      at,
    })
    const next: State = {
      deck: answerCard(state.deck, rating),
      session: appendAnswer(state.session, item.id, rating, at),
      progress: new Map(state.progress).set(item.id, progress),
      counts: { ...state.counts, [rating]: state.counts[rating] + 1 },
    }
    setBusy(true)
    try {
      await saveAnswer(next.session, progress)
      onAnswered?.()
      stopAudio()
      setPrevious(state)
      setState(next)
      setFlipped(false)
      setSaveError(null)
    } catch (e) {
      console.error(e)
      setSaveError(isQuotaError(e) ? 'quota' : 'other')
    } finally {
      setBusy(false)
    }
  }

  async function undo() {
    const undoneItemId = previous && currentCard(previous.deck)
    if (!previous || !undoneItemId || busy) return
    setBusy(true)
    try {
      await restoreBeforeAnswer(
        previous.session,
        { packId, itemId: undoneItemId },
        previous.progress.get(undoneItemId),
      )
      stopAudio()
      setState(previous)
      setPrevious(null)
      setFlipped(false)
      setSaveError(null)
    } catch (e) {
      console.error(e)
      setSaveError(isQuotaError(e) ? 'quota' : 'other')
    } finally {
      setBusy(false)
    }
  }

  async function report() {
    if (!item) return
    try {
      const itemId = item.id
      const nowReported = await toggleReport(packId, itemId, Date.now())
      setReported((prev) => {
        const next = new Set(prev)
        if (nowReported) next.add(itemId)
        else next.delete(itemId)
        return next
      })
      setSaveError(null)
    } catch (e) {
      console.error(e)
      setSaveError(isQuotaError(e) ? 'quota' : 'other')
    }
  }

  const topBar = (
    <div className={styles.topBar}>
      <Link to={exitPath} className={styles.exit} aria-label="学習をやめる">
        ✕
      </Link>
      <span className={styles.position}>
        {isFinished(state.deck)
          ? '完了'
          : `${state.deck.position + 1} / ${state.deck.queue.length}`}
      </span>
      <button
        type="button"
        className={styles.undo}
        onClick={undo}
        disabled={!previous || busy}
      >
        1 つ戻す
      </button>
    </div>
  )

  const errorMessage = saveError && (
    <p className={styles.error} role="alert">
      {saveError === 'quota'
        ? '端末の空き容量が足りないため、保存できませんでした。空き容量を増やしてから、もう一度操作してください。'
        : '保存できませんでした。もう一度操作してください。'}
    </p>
  )

  if (!item) {
    return (
      <div className={styles.screen}>
        {topBar}
        {errorMessage}
        <Summary counts={state.counts} exitPath={exitPath} />
      </div>
    )
  }

  const { audio } = item
  const audioButton = (label: string, size?: PlayButtonSize) =>
    audio && (
      <PlayButton
        label={label}
        size={size}
        onPlay={() => playAudio(packId, audio)}
      />
    )
  // 単語の音声 → 解説の表面では、再生ボタンを主役として大きくし、読み上げソフトにも単語を伝えない
  const frontAudioButton =
    face === 'word-audio'
      ? audioButton('単語の音声', 'huge')
      : audioButton(`${item.word} の音声`, 'large')

  return (
    <div className={styles.screen}>
      {topBar}
      {errorMessage}
      {notice && state.deck.position === 0 && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <StudyCard
        // カードが変わったら、スワイプの途中の状態を持ち越さない
        key={`${state.deck.position}`}
        flipped={flipped}
        onFlip={() => setFlipped(true)}
        onRate={answer}
        front={
          // 単語の音声 → 解説では、単語の文字を出さず再生ボタンだけを大きく置く（study-cards.md 3 章）
          <div className={styles.front}>
            {face !== 'word-audio' && (
              <p className={styles.frontWord} lang="en">
                {item.word}
              </p>
            )}
            {frontAudioButton && (
              <div className={styles.audioBand} data-face={face} data-no-flip>
                {frontAudioButton}
              </div>
            )}
            <p className={styles.hint}>
              {face === 'word-audio'
                ? '音声を聞いて意味を思い出したら、タップして裏返す'
                : 'タップして裏返す'}
            </p>
          </div>
        }
        back={
          <FitContent>
            <Explanation
              item={item}
              wordAside={
                <>
                  {audioButton(`${item.word} の音声`)}
                  <button
                    type="button"
                    className={styles.report}
                    data-reported={reported.has(item.id)}
                    onClick={report}
                    aria-pressed={reported.has(item.id)}
                    aria-label="解説の誤りを報告"
                  >
                    {reported.has(item.id) ? '⚑ 報告済み' : '⚐ 誤りを報告'}
                  </button>
                </>
              }
            />
          </FitContent>
        }
      />
      <div className={styles.ratings}>
        {(['forgot', 'unsure', 'remembered'] as const).map((rating) => (
          <button
            key={rating}
            type="button"
            className={styles.rating}
            data-rating={rating}
            onClick={() => answer(rating)}
            disabled={!flipped || busy}
          >
            {RATING_LABELS[rating]}
          </button>
        ))}
      </div>
    </div>
  )
}

function Summary({ counts, exitPath }: { counts: Counts; exitPath: string }) {
  return (
    <div className={styles.summary}>
      <h1>おつかれさまでした</h1>
      <ul className={styles.counts}>
        {(['remembered', 'unsure', 'forgot'] as const).map((rating) => (
          <li key={rating} data-rating={rating}>
            {RATING_LABELS[rating]} <strong>{counts[rating]}</strong>
          </li>
        ))}
      </ul>
      <Link to={exitPath} className={styles.done}>
        ユニット一覧へ
      </Link>
    </div>
  )
}
