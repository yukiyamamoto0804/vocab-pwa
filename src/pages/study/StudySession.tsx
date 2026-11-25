import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Explanation } from '../../components/Explanation'
import { Loading } from '../../components/Loading'
import { PlayButton, type PlayButtonSize } from '../../components/PlayButton'
import {
  type FrontSenseChoice,
  getExampleTextShown,
  getFrontSenseChoice,
} from '../../db/settings'
import {
  type InProgressStudy,
  restoreBeforeAnswer,
  type SettingBefore,
  saveAnswer,
  toggleReport,
} from '../../db/study'
import type {
  Face,
  ItemRecord,
  ProgressRecord,
  Rating,
  SettingRecord,
  StudyMode,
  StudySessionRecord,
} from '../../db/types'
import { RECORD_ONLY_FACES } from '../../db/types'
import { playExample, playWord } from '../../features/audio/playback'
import { playAudio, stopAudio } from '../../features/audio/player'
import {
  frontContentOf,
  isAudioFace,
  isAutoAdvanceFace,
  pickFrontSense,
} from '../../features/cards/faces'
import { applyAnswer } from '../../features/mastery/mastery'
import {
  answerCard,
  createDeck,
  currentCard,
  type Deck,
  isFinished,
  replayDeck,
} from '../../features/session/deck'
import type { Resumable } from '../../features/session/inProgress'
import {
  answersOf,
  appendAnswer,
  countRatings,
  createSessionRecord,
  removeLastAnswer,
} from '../../features/session/sessionRecord'
import { studyConfig } from '../../features/studyConfig'
import { isQuotaError } from '../../lib/errors'
import { randomId } from '../../lib/random'
import { RETURN_TO_UNITS } from '../../lib/returnToUnits'
import { useAsync } from '../../lib/useAsync'
import { ExampleAudioFront } from './ExampleAudioFront'
import { FitContent } from './FitContent'
import { JaFront } from './JaFront'
import { RATING_LABELS } from './ratingLabels'
import { StudyCard } from './StudyCard'
import styles from './StudySession.module.css'
import { useAutoAdvance } from './useAutoAdvance'

type Counts = Record<Rating, number>

/** 1 回の学習の状態。申告の回数は回答の記録から数える */
interface State {
  deck: Deck
  session: StudySessionRecord
  progress: Map<string, ProgressRecord>
  /** 回答ごとの、回答する前の学習状況（初めての回答なら undefined）。「1 つ戻す」で戻すため */
  priors: (ProgressRecord | undefined)[]
  /** 最初の回答で書き換えた設定の、書き換える前の値。回答をすべて取り消したら戻す */
  before: SettingBefore[]
}

interface Props {
  packId: string
  mode: StudyMode
  face: Face
  /** 出す順に並べた単語（途中から再開するときは、最初の並び） */
  items: ItemRecord[]
  initialProgress: Map<string, ProgressRecord>
  initialReported: Set<string>
  exitPath: string
  /** 同じ学習かを見分けるキー（features/session/inProgress.ts）。途中の学習と一緒に保存する */
  studyKey: string
  /** 最初の回答と一緒に書く設定を作る（前回学習したユニット など） */
  firstAnswerSettings?: (at: number) => SettingRecord[]
  /** 途中から再開するときの、やめたときの状態 */
  resume?: Resumable
  /** 最初のカードの上に出すお知らせ（表面に必要なデータがなくて出さない単語があるときなど） */
  notice?: string
}

/** 学習画面で使う表面の表示の設定 */
interface DisplaySettings {
  /** 表面に例文を使う種類の例文の選び方（study-cards.md 4 章） */
  frontSenseChoice: FrontSenseChoice
  /** 「例文の音声」で、空欄の英文を最初から表示するか（study-cards.md 3 章） */
  exampleTextShown: boolean
}

const loadDisplaySettings = async (): Promise<DisplaySettings> => {
  const [frontSenseChoice, exampleTextShown] = await Promise.all([
    getFrontSenseChoice(),
    getExampleTextShown(),
  ])
  return { frontSenseChoice, exampleTextShown }
}

// 表面に使う用法は学習を始めるときに 1 回だけ選ぶので、設定を読み終えてから学習を始める。
// 1 枚目のカードで例文が後から出てこないよう、表示の設定もここでまとめて読む
export function StudySession(props: Props) {
  const settings = useAsync(loadDisplaySettings, [])
  if (settings.status === 'loading') return <Loading />
  // 読めなかったときは初期値（ランダム・例文はボタンで表示）で始める
  return (
    <StudySessionBody
      {...props}
      {...(settings.status === 'done'
        ? settings.value
        : { frontSenseChoice: 'random', exampleTextShown: false })}
    />
  )
}

function StudySessionBody(props: Props & DisplaySettings) {
  const { packId, mode, face, items, exitPath, studyKey, notice } = props
  const [order] = useState(() => items.map((i) => i.id))
  const [state, setState] = useState<State>(() =>
    props.resume
      ? {
          deck: props.resume.deck,
          session: props.resume.session,
          progress: props.initialProgress,
          priors: props.resume.priors,
          before: props.resume.before,
        }
      : {
          deck: createDeck(order),
          session: createSessionRecord({
            id: randomId(),
            packId,
            mode,
            face,
            startedAt: Date.now(),
          }),
          progress: props.initialProgress,
          priors: [],
          before: [],
        },
  )
  const [flipped, setFlipped] = useState(false)
  const [reported, setReported] = useState(props.initialReported)
  const [busy, setBusy] = useState(false)
  /** 保存中か。描き直す前に続けて申告が来ても（自動で進める学習の時間切れと指の申告が重なった など）、2 回保存しないように */
  const busyRef = useRef(false)
  /**
   * 保存の失敗。容量不足なら 'quota'。それ以外が続いたら 'persistent'（もう一度押しても直らない失敗。
   * iOS で背景から戻ったときに DB との接続が切れた、新しい版が DB を更新した など）
   */
  const [saveError, setSaveError] = useState<
    'quota' | 'other' | 'persistent' | null
  >(null)
  /** 容量不足以外の保存の失敗が続いた回数 */
  const failureCount = useRef(0)
  function saveFailed(e: unknown) {
    console.error(e)
    if (isQuotaError(e)) {
      failureCount.current = 0
      setSaveError('quota')
      return
    }
    failureCount.current += 1
    setSaveError(failureCount.current >= 2 ? 'persistent' : 'other')
  }
  function saveSucceeded() {
    failureCount.current = 0
    setSaveError(null)
  }
  /** 裏返した時刻。表面を素早く 2 回タップしたとき、2 回目が裏面のボタン（誤りの報告）に届かないようにする */
  const flippedAt = useRef(0)
  /** 表面に出すもの（自動で進める学習は、「単語の音声」と同じ） */
  const frontContent = frontContentOf(face)
  /**
   * 表面に例文を使う種類（「例文の訳」、「例文の音声」）で、単語ごとに表面に使う用法。
   * 学習を始めるときに 1 回だけ選び、その回の学習の間（裏返す・出し直す）は同じ用法のままにする（study-cards.md 3 章）
   */
  const [frontSenses] = useState(
    () =>
      new Map(
        frontContent === 'ja' || frontContent === 'example-audio'
          ? items.map((i): [string, number] => [
              i.id,
              props.resume?.frontSenses.get(i.id) ??
                pickFrontSense(i, frontContent, props.frontSenseChoice),
            ])
          : [],
      ),
  )

  const { exampleTextShown } = props
  const autoAdvance = isAutoAdvanceFace(face)

  // 画面を離れたら、再生中の音声を止める
  useEffect(() => stopAudio, [])

  const itemId = currentCard(state.deck)
  const item = items.find((i) => i.id === itemId)

  function flip() {
    flippedAt.current = Date.now()
    setFlipped(true)
  }

  const auto = useAutoAdvance({
    enabled: autoAdvance,
    packId,
    audio: item?.audio,
    cardKey: state.session.itemIds.length,
    flipped,
    flip,
    rate: answer,
  })

  /** 保存する途中の学習 */
  function inProgressOf(st: State): InProgressStudy {
    return {
      key: studyKey,
      sessionId: st.session.id,
      order,
      frontSenses: Object.fromEntries(frontSenses),
      priors: st.priors.map((p) => p ?? null),
      before: st.before,
    }
  }

  async function answer(rating: Rating) {
    if (!flipped || busyRef.current || !item) return
    const at = Date.now()
    // 記録だけを残す表面（自動で進める学習）では、定着度・最終出題日を更新しない（study-cards.md 11 章）
    const progress = RECORD_ONLY_FACES.includes(face)
      ? undefined
      : applyAnswer(state.progress.get(item.id), {
          packId,
          itemId: item.id,
          face,
          rating,
          at,
        })
    const next: State = {
      deck: answerCard(state.deck, rating),
      session: appendAnswer(state.session, item.id, rating, at),
      progress: progress
        ? new Map(state.progress).set(item.id, progress)
        : state.progress,
      priors: [...state.priors, state.progress.get(item.id)],
      before: state.before,
    }
    busyRef.current = true
    setBusy(true)
    try {
      const before = await saveAnswer({
        session: next.session,
        progress,
        // 最後まで終えたら、途中の学習を消す
        inProgress: isFinished(next.deck) ? undefined : inProgressOf(next),
        firstAnswerSettings: props.firstAnswerSettings?.(at),
      })
      stopAudio()
      setState({ ...next, before })
      setFlipped(false)
      saveSucceeded()
    } catch (e) {
      // 自動で進めていたら止める（保存できないまま次々と「忘れた」にしないように）
      auto.pause()
      saveFailed(e)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /** 直前の申告を取り消す。その回の最初の回答まで、続けて取り消せる */
  async function undo() {
    const last = state.session.itemIds.length - 1
    if (last < 0 || busyRef.current) return
    const session = removeLastAnswer(state.session)
    const deck = replayDeck(order, answersOf(session))
    // 自分で作った記録を当てはめ直すだけなので、食い違うことはないはず
    if (!deck) {
      console.error('取り消した後の出題を作り直せませんでした')
      return
    }
    const itemId = state.session.itemIds[last]
    const prior = state.priors[last]
    const progress = new Map(state.progress)
    if (prior) progress.set(itemId, prior)
    else progress.delete(itemId)
    const previous: State = {
      deck,
      session,
      progress,
      priors: state.priors.slice(0, -1),
      before: state.before,
    }
    busyRef.current = true
    setBusy(true)
    try {
      await restoreBeforeAnswer({
        session,
        itemId,
        progress: prior,
        inProgress: inProgressOf(previous),
      })
      stopAudio()
      setState(previous)
      setFlipped(false)
      saveSucceeded()
    } catch (e) {
      saveFailed(e)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function report() {
    if (!item) return
    // 裏返した直後のタップは、表面をタップした続きとみなして無視する
    if (Date.now() - flippedAt.current < 400) return
    // 解説をじっくり見たいときの操作なので、自動で進めていたら止める
    auto.pause()
    try {
      const itemId = item.id
      const nowReported = await toggleReport(packId, itemId, Date.now())
      setReported((prev) => {
        const next = new Set(prev)
        if (nowReported) next.add(itemId)
        else next.delete(itemId)
        return next
      })
      saveSucceeded()
    } catch (e) {
      saveFailed(e)
    }
  }

  const topBar = (
    <div className={styles.topBar}>
      {/* 戻る操作で、やめた学習にまた入らないよう、履歴に積まない */}
      <Link
        to={exitPath}
        replace
        state={RETURN_TO_UNITS}
        className={styles.exit}
      >
        {/* 終えた後は、中断ではなく閉じるだけ */}
        {isFinished(state.deck) ? '閉じる' : '中断'}
      </Link>
      <span className={styles.position}>
        {isFinished(state.deck)
          ? '完了'
          : `${state.deck.position + 1} / ${state.deck.queue.length}`}
      </span>
      <div className={styles.topActions}>
        {autoAdvance && !isFinished(state.deck) && (
          <button
            type="button"
            className={styles.barButton}
            data-primary={!auto.running}
            onClick={auto.running ? auto.pause : auto.start}
          >
            {auto.running ? '一時停止' : auto.started ? '再開' : '開始'}
          </button>
        )}
        <button
          type="button"
          className={styles.barButton}
          onClick={undo}
          disabled={state.session.itemIds.length === 0 || busy}
        >
          1 つ戻す
        </button>
      </div>
    </div>
  )

  const errorMessage = saveError && (
    <p className={styles.error} role="alert">
      {saveError === 'quota'
        ? '端末の空き容量が足りないため、保存できませんでした。空き容量を増やしてから、もう一度操作してください。'
        : saveError === 'persistent'
          ? '保存できない状態が続いています。アプリを開き直してください（最後の回答より前は保存されています）。'
          : '保存できませんでした。もう一度操作してください。'}
    </p>
  )

  if (!item) {
    return (
      <div className={styles.screen}>
        {topBar}
        {errorMessage}
        <Summary counts={countRatings(state.session)} exitPath={exitPath} />
      </div>
    )
  }

  // 音声があれば音声、なければ機械の音声で読む（study-cards.md 9 章）
  // before は再生する前に呼ぶ（裏面では、自動で進めていたら止める）
  const wordButton = (
    label: string,
    size?: PlayButtonSize,
    before?: () => void,
  ) => (
    <PlayButton
      label={label}
      size={size}
      onPlay={() => {
        before?.()
        return playWord(packId, item)
      }}
    />
  )
  // 音声の表面では、再生ボタンを主役として大きくし、読み上げソフトにも単語や例文を伝えない。
  // 聞き取りの練習なので機械の音声は使わず、教材の音声だけを鳴らす（出題するのは音声がある単語・用法だけ。study-cards.md 3 章）
  const frontAudio =
    frontContent === 'word-audio'
      ? item.audio
      : frontContent === 'example-audio'
        ? item.senses[frontSenses.get(item.id) ?? 0].exampleAudio
        : undefined
  const audioOnly = isAudioFace(face)
  const frontAudioButton = auto.running ? (
    // 自動で進めている間は、押して流れが乱れないよう、再生ボタンの代わりに状態だけを出す
    <p className={styles.autoStatus}>自動で進めています</p>
  ) : audioOnly ? (
    frontAudio && (
      <PlayButton
        label={frontContent === 'word-audio' ? '単語の音声' : '例文の音声'}
        size="huge"
        onPlay={() => playAudio(packId, frontAudio)}
      />
    )
  ) : (
    wordButton(`${item.word} の音声`, 'large')
  )

  return (
    <div className={styles.screen}>
      {topBar}
      {errorMessage}
      {auto.error && (
        <p className={styles.error} role="alert">
          {auto.error}
          。止めました。このカードは自分で裏返して申告し、次のカードで「再開」を押してください
        </p>
      )}
      {notice && state.deck.position === 0 && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <StudyCard
        // カードが変わったら、スワイプの途中の状態を持ち越さない
        key={`${state.deck.position}`}
        flipped={flipped}
        onFlip={flip}
        onTouchChange={auto.touch}
        onRate={answer}
        front={
          frontContent === 'ja' ? (
            <JaFront item={item} senseIndex={frontSenses.get(item.id) ?? 0} />
          ) : frontContent === 'example-audio' ? (
            <ExampleAudioFront
              item={item}
              senseIndex={frontSenses.get(item.id) ?? 0}
              playButton={frontAudioButton}
              initiallyShown={exampleTextShown}
            />
          ) : (
            // 「英単語」と「単語の音声」の表面。「単語の音声」では、文字を出さず再生ボタンだけを大きく置く（study-cards.md 3 章）
            <div className={styles.front}>
              {!audioOnly && (
                <p className={styles.frontWord} lang="en">
                  {item.word}
                </p>
              )}
              <div
                className={styles.audioBand}
                data-audio-only={audioOnly}
                data-no-flip
              >
                {frontAudioButton}
              </div>
              <p className={styles.hint}>
                {autoAdvance && !auto.started
                  ? '「開始」を押すと、音声を 2 回流して自動で進みます'
                  : audioOnly
                    ? '音声を聞いて意味を思い出したら、タップして裏返す'
                    : 'タップして裏返す'}
              </p>
            </div>
          )
        }
        back={
          <FitContent>
            <Explanation
              item={item}
              wordAside={
                <>
                  {wordButton(`${item.word} の音声`, undefined, auto.hold)}
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
              exampleAside={(i) => (
                <PlayButton
                  label={
                    item.senses.length > 1
                      ? `例文 ${i + 1} の音声`
                      : '例文の音声'
                  }
                  onPlay={() => {
                    auto.hold()
                    return playExample(packId, item.senses[i])
                  }}
                />
              )}
            />
          </FitContent>
        }
      />
      {autoAdvance && (
        // 申告を待っている間、「忘れた」になるまでの残りの時間を帯で示す
        <div className={styles.countdown} aria-hidden="true">
          {auto.waiting !== undefined && (
            <div
              // 指を離して待ち直したら、帯を最初から描き直す
              key={auto.waiting}
              className={styles.countdownBar}
              style={{
                animationDuration: `${studyConfig.autoAdvance.waitMs}ms`,
              }}
            />
          )}
        </div>
      )}
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
      <Link
        to={exitPath}
        replace
        state={RETURN_TO_UNITS}
        className={styles.done}
      >
        ユニット一覧へ
      </Link>
    </div>
  )
}
