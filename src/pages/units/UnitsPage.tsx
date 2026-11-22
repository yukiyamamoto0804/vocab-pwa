import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { LinkList } from '../../components/LinkList'
import { LoadError } from '../../components/LoadError'
import { getPack, listUnitSummaries } from '../../db/content'
import { getLastTest, getLastUnitStudy } from '../../db/settings'
import { buildStudyQuery } from '../../features/session/studyQuery'
import { defaultTestRange } from '../../features/session/testItems'
import { studyConfig } from '../../features/studyConfig'
import { useAsync } from '../../lib/useAsync'
import { TestSheet } from './TestSheet'
import styles from './UnitsPage.module.css'
import { unitLabel } from './unitLabel'

export function UnitsPage() {
  const { packId = '' } = useParams()
  const data = useAsync(
    () =>
      Promise.all([
        getPack(packId),
        listUnitSummaries(packId),
        getLastTest(packId),
        getLastUnitStudy(packId),
      ]),
    [packId],
  )
  const [testOpen, setTestOpen] = useState(false)

  if (data.status === 'loading') return null
  if (data.status === 'error') return <LoadError />
  const [pack, units, lastTest, lastUnitStudy] = data.value
  if (!pack) {
    return (
      <>
        <p>教材パックが見つかりません。</p>
        <Link to="/">ホームへ戻る</Link>
      </>
    )
  }

  const testRange = defaultTestRange(
    units.map(({ unit, learnedCount }) => ({ id: unit.id, learnedCount })),
    lastTest,
  )

  return (
    <>
      <Link to="/">← 教材パック</Link>
      <div className={styles.header}>
        <h1>{pack.manifest.title}</h1>
        {testRange && (
          <button
            type="button"
            className={styles.test}
            onClick={() => setTestOpen(true)}
          >
            テスト
          </button>
        )}
      </div>
      <LinkList
        items={units.map(({ unit, itemCount, learnedCount }) => ({
          key: String(unit.id),
          to: `/packs/${encodeURIComponent(packId)}/units/${unit.id}`,
          title: unitLabel(unit),
          meta: `${itemCount} 語・学習済み ${learnedCount} 語`,
          badge: unit.id === lastUnitStudy?.unitId ? '前回' : undefined,
          action: {
            to: `/study?${buildStudyQuery({
              mode: 'unit',
              packId,
              face: 'en',
              unitId: unit.id,
              mixCount: studyConfig.mixCount.default,
            })}`,
            label: '学習',
          },
        }))}
      />
      {testRange && (
        <TestSheet
          open={testOpen}
          onClose={() => setTestOpen(false)}
          packId={packId}
          units={units}
          initialRange={testRange}
        />
      )}
    </>
  )
}
