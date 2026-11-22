import type { UnitRecord } from '../../db/types'

/** 画面に出すユニットの名前（例: 「ユニット 3　名前」） */
export function unitLabel(unit: UnitRecord): string {
  return unit.title
    ? `ユニット ${unit.id}　${unit.title}`
    : `ユニット ${unit.id}`
}
