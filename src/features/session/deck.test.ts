import { describe, expect, it } from 'vitest'
import {
  answerCard,
  createDeck,
  createUnitDeck,
  currentCard,
  isFinished,
} from './deck'

describe('deck', () => {
  it('申告するたびに次のカードへ進み、全て終わると終了になる', () => {
    let deck = createDeck(['a', 'b'])
    expect(currentCard(deck)).toBe('a')
    deck = answerCard(deck, 'remembered')
    expect(currentCard(deck)).toBe('b')
    deck = answerCard(deck, 'unsure')
    expect(isFinished(deck)).toBe(true)
    expect(currentCard(deck)).toBeUndefined()
  })

  it('「忘れた」カードは最後にもう一度出し、また忘れたらさらに後ろに回す', () => {
    let deck = createDeck(['a', 'b'])
    deck = answerCard(deck, 'forgot') // a を忘れた
    deck = answerCard(deck, 'remembered') // b
    expect(currentCard(deck)).toBe('a')
    deck = answerCard(deck, 'forgot') // a をまた忘れた
    expect(currentCard(deck)).toBe('a')
    deck = answerCard(deck, 'unsure')
    expect(isFinished(deck)).toBe(true)
  })

  it('終わった後に申告しても変わらない', () => {
    const deck = answerCard(createDeck(['a']), 'remembered')
    expect(answerCard(deck, 'forgot')).toBe(deck)
  })

  it('ユニット学習では、単語をランダムに並べて出す', () => {
    // 並べ替えの細部は shuffle のテスト（lib/random.test.ts）で確かめている
    const deck = createUnitDeck(['a', 'b', 'c'], () => 0)
    expect([...deck.queue].sort()).toEqual(['a', 'b', 'c'])
    expect(deck.queue).not.toEqual(['a', 'b', 'c'])
    expect(deck.position).toBe(0)
  })
})
