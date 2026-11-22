import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { LoadError } from '../../components/LoadError'
import { PlayButton } from '../../components/PlayButton'
import { getProgressMap, getUnit, listUnitItems } from '../../db/content'
import type { ItemRecord, ProgressRecord } from '../../db/types'
import { playWord } from '../../features/audio/playback'
import { stopAudio } from '../../features/audio/player'
import { useAsync } from '../../lib/useAsync'
import styles from './WordsPage.module.css'

export function WordsPage() {
  const { packId = '', unitId: unitParam = '' } = useParams()
  const unitId = Number(unitParam)
  const data = useAsync(async () => {
    // URL のユニット番号が数でなければ、見つからない扱いにする
    if (!Number.isInteger(unitId))
      return {
        unit: undefined,
        items: [],
        progress: new Map<string, ProgressRecord>(),
      }
    const [unit, items] = await Promise.all([
      getUnit(packId, unitId),
      listUnitItems(packId, unitId),
    ])
    const progress = await getProgressMap(
      packId,
      items.map((i) => i.id),
    )
    return { unit, items, progress }
  }, [packId, unitId])

  // 画面を離れたら、再生中の音声を止める
  useEffect(() => stopAudio, [])

  const back = (
    <Link to={`/packs/${encodeURIComponent(packId)}`}>← ユニット一覧</Link>
  )
  if (data.status === 'loading') return back
  if (data.status === 'error') return <LoadError />
  const { unit, items, progress } = data.value
  if (!unit) {
    return (
      <>
        {back}
        <p>ユニットが見つかりません。</p>
      </>
    )
  }

  return (
    <>
      {back}
      <h1>
        ユニット {unit.id}
        {unit.title && <span className={styles.unitTitle}>{unit.title}</span>}
      </h1>
      <ul className={styles.list}>
        {items.map((item) => (
          <WordRow key={item.id} item={item} progress={progress.get(item.id)} />
        ))}
      </ul>
    </>
  )
}

function WordRow({
  item,
  progress,
}: {
  item: ItemRecord
  progress?: ProgressRecord
}) {
  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <div className={styles.head}>
          <span className={styles.word}>{item.word}</span>
          <span className={styles.mastery}>
            {progress
              ? `定着度 ${Math.round(progress.mastery * 100)}%`
              : '未学習'}
          </span>
        </div>
        {item.senses.map((sense, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 用法に id はなく、並び替えない
          <p key={i} className={styles.meanings}>
            {sense.meanings.map((m) => `【${m.pos}】${m.meaning}`).join(' ')}
          </p>
        ))}
      </div>
      {/* 音声があれば音声、なければ機械の音声で読む（study-cards.md 9 章） */}
      <PlayButton
        label={`${item.word} の音声`}
        onPlay={() => playWord(item.packId, item)}
      />
    </li>
  )
}
