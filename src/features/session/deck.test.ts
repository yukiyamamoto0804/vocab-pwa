import { describe, expect, it } from 'vitest'
import {
  answerCard,
  createDeck,
  currentCard,
  isFinished,
  replayDeck,
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

  it('記録した回答を当てはめて、同じ状態を作り直す。食い違えば undefined', () => {
    const answered = answerCard(
      answerCard(createDeck(['a', 'b']), 'forgot'),
      'remembered',
    )
    expect(
      replayDeck(
        ['a', 'b'],
        [
          { itemId: 'a', rating: 'forgot' },
          { itemId: 'b', rating: 'remembered' },
        ],
      ),
    ).toEqual(answered)
    expect(
      replayDeck(['a', 'b'], [{ itemId: 'b', rating: 'forgot' }]),
    ).toBeUndefined()
    expect(
      replayDeck(['a', 'b'], [{ itemId: 'a', rating: undefined }]),
    ).toBeUndefined()
  })
})
