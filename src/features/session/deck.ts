import type { Rating } from '../../db/types'

// 1 回の学習で出すカードの順番（docs/specs/study-cards.md 5 章「1 回の学習の進め方」）。
// 「忘れた」と申告したカードは、最後にもう一度出す。

export interface Deck {
  /** 出す順の単語 id。「忘れた」カードは後ろに足していく */
  queue: string[]
  /** 次に出すカードの位置 */
  position: number
}

export function createDeck(itemIds: string[]): Deck {
  return { queue: itemIds, position: 0 }
}

/** 今出しているカード。全て終わっていれば undefined */
export function currentCard(deck: Deck): string | undefined {
  return deck.queue[deck.position]
}

export function isFinished(deck: Deck): boolean {
  return deck.position >= deck.queue.length
}

/** 今のカードに申告して、次のカードへ進めた新しい状態を返す */
export function answerCard(deck: Deck, rating: Rating): Deck {
  const card = currentCard(deck)
  if (card === undefined) return deck
  return {
    queue: rating === 'forgot' ? [...deck.queue, card] : deck.queue,
    position: deck.position + 1,
  }
}
