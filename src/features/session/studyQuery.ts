import { FACES, type Face, type TestOrder } from '../../db/types'
import { studyConfig } from '../studyConfig'
import type { StudyCount } from './studyCount'

// 学習画面の条件。URL のクエリで受け渡す（docs/ARCHITECTURE.md 1 章）。

interface BaseQuery {
  packId: string
  face: Face
}

export interface UnitQuery extends BaseQuery {
  mode: 'unit'
  unitId: number
}

export interface TestQuery extends BaseQuery {
  mode: 'test'
  /** 範囲の開始のユニット番号 */
  fromUnit: number
  /** 範囲の終了のユニット番号（開始以上） */
  toUnit: number
  count: StudyCount
  includeUnlearned: boolean
  order: TestOrder
}

export interface ReviewQuery extends BaseQuery {
  mode: 'review'
  /** 対象範囲（直前何回の学習か） */
  sessionCount: number
  /** 出題数（選択肢はテストと同じ） */
  count: StudyCount
}

export type StudyQuery = UnitQuery | TestQuery | ReviewQuery

const DEFAULT_FACE: Face = 'en'

export function buildStudyQuery(query: StudyQuery): string {
  const params = new URLSearchParams({
    mode: query.mode,
    pack: query.packId,
    face: query.face,
  })
  if (query.mode === 'unit') {
    params.set('units', String(query.unitId))
  } else if (query.mode === 'review') {
    params.set('sessions', String(query.sessionCount))
    params.set('count', String(query.count))
  } else {
    params.set('from', String(query.fromUnit))
    params.set('to', String(query.toUnit))
    params.set('count', String(query.count))
    if (query.includeUnlearned) params.set('unlearned', '1')
    params.set('order', query.order)
  }
  return params.toString()
}

/** 1 以上の整数の文字列なら数にする */
function parsePositiveInt(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null
}

/** 出題数の選択肢にあればその値、なければ fallback */
function parseCount(value: string | null, fallback: StudyCount): StudyCount {
  return (
    studyConfig.studyCount.options.find((c) => String(c) === value) ?? fallback
  )
}

// 不正な条件なら null を返す。
// face・count・unlearned・order・sessions は省略・不明な値のときデフォルトにする。
export function parseStudyQuery(params: URLSearchParams): StudyQuery | null {
  const mode = params.get('mode')
  const packId = params.get('pack')
  if (!packId) return null

  const faceParam = params.get('face')
  const face = FACES.find((f) => f === faceParam) ?? DEFAULT_FACE

  if (mode === 'unit') {
    const unitId = parsePositiveInt(params.get('units'))
    if (unitId === null) return null
    return { mode, packId, face, unitId }
  }

  if (mode === 'test') {
    const fromUnit = parsePositiveInt(params.get('from'))
    const toUnit = parsePositiveInt(params.get('to'))
    if (fromUnit === null || toUnit === null || fromUnit > toUnit) return null
    const count = parseCount(params.get('count'), studyConfig.testCount.default)
    const orderParam = params.get('order')
    const order: TestOrder =
      orderParam === 'weak' || orderParam === 'random'
        ? orderParam
        : studyConfig.testOrder.default
    return {
      mode,
      packId,
      face,
      fromUnit,
      toUnit,
      count,
      includeUnlearned: params.get('unlearned') === '1',
      order,
    }
  }

  if (mode === 'review') {
    const { min, max, default: fallback } = studyConfig.reviewSessionRange
    const value = parsePositiveInt(params.get('sessions'))
    const sessionCount =
      value !== null && value >= min && value <= max ? value : fallback
    const count = parseCount(
      params.get('count'),
      studyConfig.reviewCount.default,
    )
    return { mode, packId, face, sessionCount, count }
  }

  return null
}
