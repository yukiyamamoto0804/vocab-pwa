import {
  FACES,
  type Face,
  type StudyMode,
  type TestOrder,
} from '../../db/types'
import { studyConfig } from '../studyConfig'

// 学習画面の条件。URL のクエリで受け渡す（docs/ARCHITECTURE.md 1 章）。
export interface StudyQuery {
  mode: StudyMode
  packId: string
  unitIds: number[]
  face: Face
  /** ユニット学習のときだけ使う。混ぜる単語の数 */
  mixCount: number
  /** テストのときだけ使う */
  order: TestOrder
}

const DEFAULT_FACE: Face = 'en'
const DEFAULT_ORDER: TestOrder = 'weak'

export function buildStudyQuery(query: StudyQuery): string {
  const params = new URLSearchParams({
    mode: query.mode,
    pack: query.packId,
    units: query.unitIds.join(','),
    face: query.face,
  })
  if (query.mode === 'unit') params.set('mix', String(query.mixCount))
  if (query.mode === 'test') params.set('order', query.order)
  return params.toString()
}

// 不正な条件なら null を返す。face・mix・order は省略・不明な値のときデフォルトにする。
export function parseStudyQuery(params: URLSearchParams): StudyQuery | null {
  const mode = params.get('mode')
  if (mode !== 'unit' && mode !== 'test') return null

  const packId = params.get('pack')
  if (!packId) return null

  // ユニット番号は 1 以上の整数。重複は除く
  const unitParts = (params.get('units') ?? '').split(',')
  if (!unitParts.every((s) => /^[1-9]\d*$/.test(s))) return null
  const unitIds = [...new Set(unitParts.map(Number))]
  if (mode === 'unit' && unitIds.length !== 1) return null

  const faceParam = params.get('face')
  const face = FACES.find((f) => f === faceParam) ?? DEFAULT_FACE

  const { min, max, default: defaultMix } = studyConfig.mixCount
  const mixParam = params.get('mix') ?? ''
  const mix = Number(mixParam)
  const mixCount =
    /^\d+$/.test(mixParam) && mix >= min && mix <= max ? mix : defaultMix

  const orderParam = params.get('order')
  const order: TestOrder =
    orderParam === 'weak' || orderParam === 'random'
      ? orderParam
      : DEFAULT_ORDER

  return { mode, packId, unitIds, face, mixCount, order }
}
