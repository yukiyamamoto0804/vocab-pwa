import { describe, expect, it } from 'vitest'
import { buildStudyQuery, parseStudyQuery, type StudyQuery } from './studyQuery'

const parse = (search: string) => parseStudyQuery(new URLSearchParams(search))

describe('buildStudyQuery / parseStudyQuery', () => {
  it.each<StudyQuery>([
    {
      mode: 'test',
      packId: 'sample-pack',
      face: 'word-audio',
      fromUnit: 2,
      toUnit: 5,
      count: 'all',
      includeUnlearned: true,
      order: 'random',
    },
    {
      mode: 'test',
      packId: 'sample-pack',
      face: 'en',
      fromUnit: 3,
      toUnit: 3,
      count: 20,
      includeUnlearned: false,
      order: 'weak',
    },
    {
      mode: 'unit',
      packId: 'sample-pack',
      face: 'ja',
      unitId: 3,
      mixCount: 0,
    },
  ])('組み立てたクエリを読み戻すと元の条件になる（$mode）', (query) => {
    expect(parse(buildStudyQuery(query))).toEqual(query)
  })

  it('ユニット学習のクエリにはテストの条件を含めない', () => {
    const search = buildStudyQuery({
      mode: 'unit',
      packId: 'p',
      face: 'en',
      unitId: 3,
      mixCount: 5,
    })
    for (const key of ['from', 'to', 'count', 'unlearned', 'order'])
      expect(new URLSearchParams(search).has(key)).toBe(false)
  })

  it('テストのクエリにはユニット学習の条件を含めない', () => {
    const search = buildStudyQuery({
      mode: 'test',
      packId: 'p',
      face: 'en',
      fromUnit: 1,
      toUnit: 2,
      count: 50,
      includeUnlearned: false,
      order: 'weak',
    })
    for (const key of ['units', 'mix'])
      expect(new URLSearchParams(search).has(key)).toBe(false)
  })

  it('unlearned は未学習の語を含めるときだけ 1 を載せる', () => {
    const query = {
      mode: 'test',
      packId: 'p',
      face: 'en',
      fromUnit: 1,
      toUnit: 2,
      count: 50,
      order: 'weak',
    } as const
    const get = (includeUnlearned: boolean) =>
      new URLSearchParams(buildStudyQuery({ ...query, includeUnlearned })).get(
        'unlearned',
      )
    expect(get(true)).toBe('1')
    expect(get(false)).toBeNull()
  })

  it('face・mix を省略するとデフォルトになる', () => {
    expect(parse('mode=unit&pack=p&units=1')).toMatchObject({
      face: 'en',
      mixCount: 5,
    })
  })

  it('count・unlearned・order を省略するとデフォルトになる', () => {
    expect(parse('mode=test&pack=p&from=1&to=2')).toMatchObject({
      count: 50,
      includeUnlearned: false,
      order: 'weak',
    })
  })

  it.each([
    ['範囲外', '21'],
    ['負の数', '-1'],
    ['小数', '2.5'],
    ['数字でない', 'a'],
  ])('mix が%sならデフォルトにする', (_, mix) => {
    expect(parse(`mode=unit&pack=p&units=1&mix=${mix}`)).toMatchObject({
      mixCount: 5,
    })
  })

  it('mix は範囲の端（0 と 20）を受け付ける', () => {
    expect(parse('mode=unit&pack=p&units=1&mix=0')).toMatchObject({
      mixCount: 0,
    })
    expect(parse('mode=unit&pack=p&units=1&mix=20')).toMatchObject({
      mixCount: 20,
    })
  })

  it.each(['30', '0', 'ALL', ''])(
    'count が選択肢にない（%s）ならデフォルトにする',
    (count) => {
      expect(
        parse(`mode=test&pack=p&from=1&to=2&count=${count}`),
      ).toMatchObject({ count: 50 })
    },
  )

  it('不明な face はデフォルトにする', () => {
    expect(parse('mode=unit&pack=p&units=1&face=xx')?.face).toBe('en')
  })

  it.each([
    ['mode がない', 'pack=p&units=1'],
    ['mode が不明', 'mode=quiz&pack=p&units=1'],
    ['pack がない', 'mode=unit&units=1'],
    ['units がない', 'mode=unit&pack=p'],
    ['units が複数', 'mode=unit&pack=p&units=1,2'],
    ['units が 0', 'mode=unit&pack=p&units=0'],
    ['units が小数', 'mode=unit&pack=p&units=1.5'],
    ['units が指数表記', 'mode=unit&pack=p&units=1e0'],
    ['テストで from がない', 'mode=test&pack=p&to=2'],
    ['テストで to がない', 'mode=test&pack=p&from=1'],
    ['テストで from が数字でない', 'mode=test&pack=p&from=a&to=2'],
    ['テストで to が 0', 'mode=test&pack=p&from=1&to=0'],
    ['テストで from が to より大きい', 'mode=test&pack=p&from=3&to=2'],
  ])('%s場合は null', (_, search) => {
    expect(parse(search)).toBeNull()
  })
})
