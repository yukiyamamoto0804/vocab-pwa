import { describe, expect, it } from 'vitest'
import { buildStudyQuery, parseStudyQuery, type StudyQuery } from './studyQuery'

const parse = (search: string) => parseStudyQuery(new URLSearchParams(search))

describe('buildStudyQuery / parseStudyQuery', () => {
  it.each<StudyQuery>([
    {
      mode: 'test',
      packId: 'sample-pack',
      unitIds: [1, 2, 5],
      face: 'word-audio',
      mixCount: 5,
      order: 'random',
    },
    {
      mode: 'unit',
      packId: 'sample-pack',
      unitIds: [3],
      face: 'ja',
      mixCount: 0,
      order: 'weak',
    },
  ])('組み立てたクエリを読み戻すと元の条件になる（$mode）', (query) => {
    expect(parse(buildStudyQuery(query))).toEqual(query)
  })

  it('ユニット学習のクエリには order を含めない', () => {
    const search = buildStudyQuery({
      mode: 'unit',
      packId: 'p',
      unitIds: [3],
      face: 'en',
      mixCount: 5,
      order: 'weak',
    })
    expect(search).not.toContain('order')
  })

  it('テストのクエリには mix を含めない', () => {
    const search = buildStudyQuery({
      mode: 'test',
      packId: 'p',
      unitIds: [3],
      face: 'en',
      mixCount: 5,
      order: 'weak',
    })
    expect(search).not.toContain('mix')
  })

  it('face・mix・order を省略するとデフォルトになる', () => {
    expect(parse('mode=test&pack=p&units=1,2')).toMatchObject({
      face: 'en',
      mixCount: 5,
      order: 'weak',
    })
  })

  it.each([
    ['範囲外', '21'],
    ['負の数', '-1'],
    ['小数', '2.5'],
    ['数字でない', 'a'],
  ])('mix が%sならデフォルトにする', (_, mix) => {
    expect(parse(`mode=unit&pack=p&units=1&mix=${mix}`)?.mixCount).toBe(5)
  })

  it('mix は範囲の端（0 と 20）を受け付ける', () => {
    expect(parse('mode=unit&pack=p&units=1&mix=0')?.mixCount).toBe(0)
    expect(parse('mode=unit&pack=p&units=1&mix=20')?.mixCount).toBe(20)
  })

  it('不明な face はデフォルトにする', () => {
    expect(parse('mode=unit&pack=p&units=1&face=xx')?.face).toBe('en')
  })

  it('重複したユニット番号は 1 つにまとめる', () => {
    expect(parse('mode=test&pack=p&units=2,1,2')?.unitIds).toEqual([2, 1])
  })

  it.each([
    ['mode がない', 'pack=p&units=1'],
    ['mode が不明', 'mode=quiz&pack=p&units=1'],
    ['pack がない', 'mode=unit&units=1'],
    ['units がない', 'mode=unit&pack=p'],
    ['units が数字でない', 'mode=test&pack=p&units=1,a'],
    ['units が 0 以下', 'mode=test&pack=p&units=0'],
    ['units が小数', 'mode=test&pack=p&units=1.5'],
    ['units が指数表記', 'mode=test&pack=p&units=1e0'],
    ['units に空の要素がある', 'mode=test&pack=p&units=1,,2'],
    ['ユニット学習で units が複数', 'mode=unit&pack=p&units=1,2'],
  ])('%s場合は null', (_, search) => {
    expect(parse(search)).toBeNull()
  })
})
