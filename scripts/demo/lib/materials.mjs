// デモ教材の材料（NGSL 1.2 と EJDict-hand）を、固定した版で取得して .cache/ に置く（docs/specs/demo-pack.md 3 章）。
// SHA-256 が違えば止める。取得できない（オフラインなど）ときも、確かめずに通さずに止める
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const CACHE = join(ROOT, '.cache')

/** NGSL 1.2（CC BY-SA 4.0）。順位の入った CSV */
export const NGSL = {
  url: 'https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv',
  file: 'ngsl/NGSL_12_stats.csv',
  sha256: '2098bab8955a120a9766c6282a51d7d578c6cb0a7d946600d2ffb73ba25a0b44',
}

/** EJDict-hand（CC0 1.0）。配布元のリポジトリのコミットに固定する */
export const EJDICT_COMMIT = '2dd9e71ffcefce89b4d946ce07bf51fa0573aac0'
export const EJDICT_FILES = {
  a: '1cd9bc081d6d87f1ed0757294eab1958a3a603a1348f64d50acf8752aec04015',
  b: '4fbf0e979a5c2e7186081fa169d92a9439010d732c2be48e892615de50797598',
  c: '62eb55c61ee2f7425ac8546924e25202bcfbff9e430263b1b0e3f4b4477836c4',
  d: '004ded7711a06e491fde0f565d4d302491ffb7d0913fb57e7949957dfe244fa0',
  e: '431dde8338c01fa41fd43ba14e480f25f51ec38af17722fbd4e616b6bca3267c',
  f: '2faae68995ed1116c7829064320a4cda5965df9dc0a06820118bc13ba01bdfbe',
  g: '50a0a262b258fdc159c5ea4dbe52e70ea979994750fd131b600fb43cec7092e1',
  h: 'ffdee1494e6afdf0ee4e3b54bb83fac137269a489c2c071777de45f48d684e4c',
  i: '27e3f1d0f2a83cfa457c714030af9a315e336b50e995b006573834b26add8c83',
  j: '18c6c40c9bdd09d35869b623023104645245d9cb757b7c14ca44e3e4ea79ed91',
  k: '20468de6b05b309a924465c04daca077377e57e64c222c51bf6d5e0132ee1d8f',
  l: '6091151eea48c942e197d0671501aa3a542e38319f6be2a5d655cb2e0177f2f2',
  m: '14c445ebe5df985c8a6978f6564116b8bd4b62ef1911c81ba5198b5fe3abaa29',
  n: '62fb1ea6ff2d249f49f9cfcaf8adca8d00b5971a6368a6cc487eac59c92d1876',
  o: 'fc4aeab64ae15dcb61b5a42ea58a4ea3756347a1727d1ad1b1a90dda430e6079',
  p: 'b5f5c0fadd7830d3e4f3f9b3df6e38ece22945fe26b12dcf709e6f9ad50f64f1',
  q: 'e1d590faacecaa4967f485e9cdeac035e1f6413e46781c62278941738cbc07a5',
  r: '114b44ca7ed8c712a9cec5f2e9673fbc6cabfaec7707ecbe2315d95fd01d4eb7',
  s: '150607935c835b2bf3d7a1c4ba9b49e9b036aeec3af6f2e30d2dbdd861656587',
  t: '5c7f9aeb8c35f692fc6dd7a9a5be65aeb168383c4342f268e9a080a8063d06d3',
  u: 'e1459458ee52cc737d7d1f541f70ba6511fed098f2347eec5679c28102895333',
  v: 'c58f41c5ee90f6bca2a77c415675aaf2c24cb1badb13280c212525ce1329947a',
  w: 'cb7de2de0d35d213d37bacfed7c5865901cb7eb72c45de89c4d6eb90996327b8',
  x: 'f5ef77ff89d6530721110eb13d9136af4c1c4586aa7d30b0e6943c9333c40129',
  y: '3ef6335676a78922073700d0d6a59b06949cc319c5e02699466aca7ebb1fdc21',
  z: 'eafb461cfcaeb9a36e4d7d2cae967fa2b1f61bc0c2ab61c70f26fa06424c1f87',
}
const ejdictUrl = (letter) =>
  `https://raw.githubusercontent.com/kujirahand/EJDict/${EJDICT_COMMIT}/src/${letter}.txt`

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** .cache/ にあれば読み、なければ取得して置く。SHA-256 が違えば止める */
async function cached(file, url, expected) {
  const path = join(CACHE, file)
  let data
  const fromCache = existsSync(path)
  if (fromCache) {
    data = readFileSync(path)
  } else {
    let res
    try {
      // ネットが詰まっても、git フックの中で長く止まらないようにする
      res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    } catch (e) {
      throw new Error(
        `${url} を取得できません（${e.message}）。ネットにつないでからやり直してください`,
      )
    }
    if (!res.ok) throw new Error(`${url} を取得できません（${res.status}）`)
    data = Buffer.from(await res.arrayBuffer())
  }
  if (sha256(data) !== expected)
    throw new Error(
      fromCache
        ? `${file} の SHA-256 が固定した版と違います（${path} を消して取り直すか、版を見直してください）`
        : `${url} から取得したファイルの SHA-256 が固定した版と違います（配布元が変わった可能性があります。版を見直してください）`,
    )
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, data)
  }
  return data.toString('utf8')
}

/** 順位 → 見出し語 */
export async function loadNgsl() {
  const text = await cached(NGSL.file, NGSL.url, NGSL.sha256)
  const ranks = new Map()
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [lemma, rank] = line.split(',')
    if (lemma && rank) ranks.set(Number(rank), lemma.trim())
  }
  return ranks
}

/** EJDict-hand の本文（全ファイルをつないだもの） */
export async function loadEjdict() {
  const texts = []
  for (const [letter, expected] of Object.entries(EJDICT_FILES)) {
    texts.push(
      await cached(
        `ejdict/${EJDICT_COMMIT}/${letter}.txt`,
        ejdictUrl(letter),
        expected,
      ),
    )
  }
  return texts.join('\n')
}
