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

/**
 * 最初の並び order から、記録した回答を順に当てはめた状態を返す（途中から再開する・1 つ戻すときに使う）。
 * 回答の単語や申告がその時点の出題と食い違えば undefined
 */
export function replayDeck(
  order: string[],
  answers: readonly { itemId: string; rating: Rating | undefined }[],
): Deck | undefined {
  let deck = createDeck(order)
  for (const { itemId, rating } of answers) {
    if (!rating || currentCard(deck) !== itemId) return undefined
    deck = answerCard(deck, rating)
  }
  return deck
}
