import { FACES, type Face, type TestOrder } from '../../db/types'
import { studyConfig } from '../studyConfig'

// 学習画面の条件。URL のクエリで受け渡す（docs/ARCHITECTURE.md 1 章）。

/** テストの出題数。'all' は範囲の単語すべて */
export type TestCount = (typeof studyConfig.testCount.options)[number]

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
  count: TestCount
  includeUnlearned: boolean
  order: TestOrder
}

export type StudyQuery = UnitQuery | TestQuery

const DEFAULT_FACE: Face = 'en'

export function buildStudyQuery(query: StudyQuery): string {
  const params = new URLSearchParams({
    mode: query.mode,
    pack: query.packId,
    face: query.face,
  })
  if (query.mode === 'unit') {
    params.set('units', String(query.unitId))
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
function parseUnitId(value: string | null): number | null {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : null
}

// 不正な条件なら null を返す。
// face・count・unlearned・order は省略・不明な値のときデフォルトにする。
export function parseStudyQuery(params: URLSearchParams): StudyQuery | null {
  const mode = params.get('mode')
  const packId = params.get('pack')
  if (!packId) return null

  const faceParam = params.get('face')
  const face = FACES.find((f) => f === faceParam) ?? DEFAULT_FACE

  if (mode === 'unit') {
    const unitId = parseUnitId(params.get('units'))
    if (unitId === null) return null
    return { mode, packId, face, unitId }
  }

  if (mode === 'test') {
    const fromUnit = parseUnitId(params.get('from'))
    const toUnit = parseUnitId(params.get('to'))
    if (fromUnit === null || toUnit === null || fromUnit > toUnit) return null
    const countParam = params.get('count')
    const count =
      studyConfig.testCount.options.find((c) => String(c) === countParam) ??
      studyConfig.testCount.default
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

  return null
}
