import type { Rating } from '../../db/types'

export const RATING_LABELS: Record<Rating, string> = {
  forgot: '忘れた',
  unsure: '曖昧',
  remembered: '覚えた',
}
