import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXCLUDED } from './config.mjs'
import {
  candidatesFor,
  extractCandidates,
  idiomHeadsFor,
  isBalanced,
  parseDictionary,
} from './ejdict.mjs'

// デモの 40 語の行だけを抜き出した EJDict-hand（CC0）の固定データ
const fixture = readFileSync(
  new URL('../fixtures/ejdict-demo-lines.txt', import.meta.url),
  'utf8',
)
const entries = parseDictionary(fixture)
// デモの 40 語（NGSL 1.2 の SFI Rank 1001〜1040 の見出し語。並びはアルファベット順で、NGSL の順位は含まない）
const WORDS = [
  'admit',
  'advice',
  'announce',
  'appropriate',
  'aware',
  'beat',
  'block',
  'blood',
  'budget',
  'committee',
  'content',
  'copy',
  'correct',
  'count',
  'difficulty',
  'effective',
  'element',
  'exchange',
  'famous',
  'independent',
  'invite',
  'majority',
  'medical',
  'mix',
  'none',
  'prevent',
  'purchase',
  'recommend',
  'request',
  'rich',
  'safe',
  'scene',
  'shoot',
  'stick',
  'survey',
  'telephone',
  'unless',
  'warm',
  'wind',
  'writer',
]
const candidates = (head) => [
  ...candidatesFor(entries, head, EXCLUDED).candidates,
]

describe('訳語の候補（40 語と熟語。期待値として固定する）', () => {
  it('40 語すべてに候補がある', () => {
    for (const w of WORDS) expect(candidates(w).length, w).toBeGreaterThan(0)
  })

  it('候補の一覧が変わらない', () => {
    const all = Object.fromEntries(
      WORDS.map((w) => [
        w,
        {
          candidates: candidates(w),
          idioms: Object.fromEntries(
            idiomHeadsFor(entries, w).map((h) => [h, candidates(h)]),
          ),
        },
      ]),
    )
    expect(all).toMatchSnapshot()
  })

  it('括弧の後ろの助詞を外した形も候補になる', () => {
    expect(candidates('request')).toEqual(
      expect.arrayContaining(['を頼む', '頼む']),
    )
    expect(candidates('invite')).toContain('招待する')
    expect(candidates('count')).toContain('数える')
  })

  it('言葉の途中を削った文字列は候補にならない', () => {
    expect(candidates('purchase')).toContain('手がかり')
    expect(candidates('purchase')).not.toContain('手かり')
    expect(candidates('stick')).toContain('でくの棒')
    expect(candidates('stick')).not.toContain('くの棒')
    expect(candidates('rich')).not.toContain('んでもない')
    expect(candidates('unless')).not.toContain('ないかぎり')
  })

  it('対の合わない括弧があっても、そろった部分の候補は取れる', () => {
    expect(candidatesFor(entries, 'none').skipped.length).toBeGreaterThan(0)
    expect(candidates('none').length).toBeGreaterThan(0)
  })

  it('使わない訳語と、英語の混ざったものは候補にならない', () => {
    expect(candidates('stick')).not.toContain('突す刺さる')
    expect(candidates('budget')).not.toContain('予算書budget plan予算案')
    expect(candidates('budget')).toContain('予算')
  })
})

describe('extractCandidates', () => {
  it('《》は中に別の括弧があってもまとめて消し、『』は記号だけを消す', () => {
    const { candidates } = extractCandidates(
      '〈数〉を『数える』《+『up』+『名』》 / =beatnik',
    )
    expect([...candidates]).toEqual(['を数える', '数える'])
  })

  it('「で」「の」は外さない', () => {
    const { candidates } = extractCandidates('…でないかぎり / (…の)でくの棒')
    expect([...candidates]).toEqual(['でないかぎり', 'でくの棒'])
  })
})

describe('isBalanced', () => {
  it('入れ子と種類の違いを見る', () => {
    expect(isBalanced('四大(しだい)[元素(earth)]')).toBe(true)
    expect(isBalanced('少しも』)…でない')).toBe(false)
    expect(isBalanced('(do『ing』》')).toBe(false)
  })
})

describe('parseDictionary', () => {
  it('「,」で並んだ見出しは、それぞれの見出しで引ける', () => {
    const e = parseDictionary('A,a,an\t1つの\n# 注記\nA\t優')
    expect(e.get('a')).toEqual(['1つの'])
    expect(e.get('A')).toEqual(['1つの', '優'])
  })
})

describe('候補の全体（40 語と熟語）', () => {
  const heads = WORDS.flatMap((w) => [w, ...idiomHeadsFor(entries, w)])
  const all = heads.flatMap((h) => candidates(h))

  it('括弧・印・英字・「+」「~」の残った候補がない', () => {
    const broken = all.filter((c) =>
      /[()（）[\]〈〉{}《》『』\ue000\ue001+~A-Za-z]/.test(c),
    )
    expect(broken).toEqual([])
  })

  it('使わない訳語を含む候補がない（助詞を付けた形も）', () => {
    const hits = all.filter((c) => [...EXCLUDED].some((x) => c.includes(x)))
    expect(hits).toEqual([])
  })

  it('訳が「=…」だけの熟語は、見出しには出るが候補はない', () => {
    expect(idiomHeadsFor(entries, 'blood')).toContain('blood type')
    expect(candidates('blood type')).toEqual([])
  })
})

describe('extractCandidates の分かれ道', () => {
  it('括弧が「 / 」をまたぐ行でも、括弧の中身は候補に残らない', () => {
    const { candidates } = extractCandidates('研究員(大学 / 研究所の) / 仲間')
    expect([...candidates]).toEqual(['研究員', '仲間'])
  })

  it('使わない訳語は、助詞を付けた形・外した形の両方を捨てる', () => {
    const excluded = new Set(['誤字する'])
    const { candidates } = extractCandidates(
      '〈物〉を誤字する / 正しい',
      excluded,
    )
    expect([...candidates]).toEqual(['正しい'])
  })

  it('品詞の印〈C〉〈U〉の直後では助詞を外さない', () => {
    const { candidates } = extractCandidates('〈C〉とげ / 〈人〉を招く')
    expect([...candidates]).toEqual(['とげ', 'を招く', '招く'])
  })
})
