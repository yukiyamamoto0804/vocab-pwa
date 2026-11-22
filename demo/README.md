# デモ教材（demo-ngsl）

アプリの「デモを試す」で読み込む、見本の教材パックです。20 語 × 2 ユニット（40 語）。
教材パックの形式（`docs/CONTENT_FORMAT.md`）の項目をどれも 1 回以上使っているので、自分のデータを作るときの見本にできます。
決まりは `docs/RULES.md` 11 章、作るものと確かめ方は `docs/specs/demo-pack.md`、作業の手順は `docs/DEVELOPMENT.md` にあります。

## ライセンス

このデモ教材（`manifest.json`・`items.json`・`audio/`・`audio-sources.json`・この README）は **CC BY-SA 4.0** で配布します（全文は `LICENSE`。https://creativecommons.org/licenses/by-sa/4.0/ ）。アプリのコードの MIT とは別です。

- デモ教材 © 2026 yukiyamamoto0804、CC BY-SA 4.0
- 権利が生じる部分（選んで並べた一覧・例文・例文の訳・音声など）に CC BY-SA 4.0 を適用します。生成した音声など、権利が生じるかどうかがはっきりしない部分も、同じライセンスで配布します。
- 無保証です。内容の正確さや特定の目的への適合を保証しません（CC BY-SA 4.0 の 5 条）。

## 出典

`manifest.json` の `attribution` にも同じものを書いています。

- "New General Service List (NGSL) 1.2" by Browne, C., Culligan, B., & Phillips, J. © 2026 Dr. Charles Browne. https://www.newgeneralservicelist.com/new-general-service-list — licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Modified: words with SFI Rank 1001–1040 were extracted, and translations, example sentences and audio were added.
- EJDict-hand by kujirahand, https://github.com/kujirahand/EJDict — CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/)
- Audio generated with Kokoro-82M by hexgrad (https://huggingface.co/hexgrad/Kokoro-82M ; the model is licensed under Apache-2.0), using the converted model files distributed by kokoro-onnx (https://github.com/thewh1teagle/kokoro-onnx).

### 配布元の表記（2026-11-22 に確かめたもの）

- **NGSL**（https://www.newgeneralservicelist.com/new-general-service-list ）
  - サイトのフッター: 「© 2026 Dr. Charles Browne. Word lists released under Creative Commons.」
  - ライセンスの表記: 「New General Service List by Browne, C., Culligan, B., and Phillips, J. is licensed under a Creative Commons Attribution-ShareAlike 4.0 International License.」
  - 推奨されている引用: 「Browne, C., Culligan, B. (2013). The New General Service List. Retrieved from https://www.newgeneralservicelist.com.」
  - 著者は、ライセンスの表記（3 名）に合わせました。配布元の推奨する引用（2 名）とは違います。著作権表示は、サイトのフッターの表記に合わせました。
- **EJDict-hand**（https://github.com/kujirahand/EJDict ）: 配布元の表記（README の License の節「Public Domain CC0」）に基づき、CC0 1.0 として扱います。元になった辞書の名前は、配布元に書かれていません。
- **Kokoro-82M**（https://huggingface.co/hexgrad/Kokoro-82M ）: ライセンス（Apache-2.0）と学習データ（許諾のある・著作権のない音声だけで学習したこと）は、モデルカードの記載に基づきます。声のファイルだけのライセンスの表記はありません。モデルカードに、生成した音声の利用を制限する記載はありません。モデルのライセンスは音声そのものには適用されず、音声はこのデモのライセンス（CC BY-SA 4.0）で配布します。モデルの作者がこのデモを推奨しているわけではありません。
- **kokoro-onnx**（https://github.com/thewh1teagle/kokoro-onnx ）: MIT。

## 改変の内容

NGSL 1.2 から `SFI Rank` 1001〜1040 の語を抜き出し、訳・例文・音声を加えました。

- 見出し語と並び: NGSL 1.2 の `SFI Rank` 1001〜1040 の 40 語を、順位の順に 20 語ずつ「デモ 1」「デモ 2」に分けました。単語の `id` は `ngsl-<SFI Rank>` です。
- 飛ばした語: なし
- 訳（`meanings[].meaning`）: EJDict-hand のその語の項目の訳語から選んで、「、」でつなぎました。文字は変えていません。
- イディオム: EJDict-hand の熟語の項目（見出しに空白を含む項目。複合語を含む）のうち、見本になるものを選びました。句は見出しのまま、意味はその項目の訳語から選びました。熟語の項目があっても、意味が不正確に読めるもの・人を侮辱する身ぶりを表すもの・今は使われない語・ふつうは 1 語で書く語は付けていません。
- 品詞・用法の分け方・例文・例文の訳・`exampleTarget`・例文の訳の太字の部分（`exampleTranslationTarget`。その用法の訳語か、その活用した形）は、このデモのために新しく作りました。
- 例文の訳の太字の部分は、訳の中に訳語（またはその活用した形）がそのまま出てこないときは付けていません（例: ngsl-1014 用法 1 は訳の「だれも…ない」が分かれているため、ngsl-1012 用法 1 は訳の「金持ちに」が訳語「金持ちの」の活用した形ではないため）。`exampleTranslationTarget` は省略できる項目です。辞書・単語集・教科書・Web サイトの文は写していません。
- 音声: Kokoro-82M で合成しました（下の「音声」）。

## 材料の版

材料は `scripts/demo/check-demo.mjs` が固定した版で取得し、SHA-256 を確かめます（取得日はどれも 2026-11-22）。

### NGSL 1.2

| 項目 | 値 |
|---|---|
| 取得元 | https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv |
| リダイレクト先 | https://static1.squarespace.com/static/64336926d7c6bb38965fdf3b/t/644e0be4ad7bae3d45b9e62a/1682836452194/NGSL_1.2_stats.csv （ファイル名 `NGSL_1.2_stats.csv`） |
| SHA-256 | `2098bab8955a120a9766c6282a51d7d578c6cb0a7d946600d2ffb73ba25a0b44` |

### EJDict-hand

配布元のリポジトリのコミット `2dd9e71ffcefce89b4d946ce07bf51fa0573aac0` の `src/a.txt`〜`src/z.txt` を、https://raw.githubusercontent.com/kujirahand/EJDict/2dd9e71ffcefce89b4d946ce07bf51fa0573aac0/src/<文字>.txt から取得しました。

| ファイル | SHA-256 |
|---|---|
| `src/a.txt` | `1cd9bc081d6d87f1ed0757294eab1958a3a603a1348f64d50acf8752aec04015` |
| `src/b.txt` | `4fbf0e979a5c2e7186081fa169d92a9439010d732c2be48e892615de50797598` |
| `src/c.txt` | `62eb55c61ee2f7425ac8546924e25202bcfbff9e430263b1b0e3f4b4477836c4` |
| `src/d.txt` | `004ded7711a06e491fde0f565d4d302491ffb7d0913fb57e7949957dfe244fa0` |
| `src/e.txt` | `431dde8338c01fa41fd43ba14e480f25f51ec38af17722fbd4e616b6bca3267c` |
| `src/f.txt` | `2faae68995ed1116c7829064320a4cda5965df9dc0a06820118bc13ba01bdfbe` |
| `src/g.txt` | `50a0a262b258fdc159c5ea4dbe52e70ea979994750fd131b600fb43cec7092e1` |
| `src/h.txt` | `ffdee1494e6afdf0ee4e3b54bb83fac137269a489c2c071777de45f48d684e4c` |
| `src/i.txt` | `27e3f1d0f2a83cfa457c714030af9a315e336b50e995b006573834b26add8c83` |
| `src/j.txt` | `18c6c40c9bdd09d35869b623023104645245d9cb757b7c14ca44e3e4ea79ed91` |
| `src/k.txt` | `20468de6b05b309a924465c04daca077377e57e64c222c51bf6d5e0132ee1d8f` |
| `src/l.txt` | `6091151eea48c942e197d0671501aa3a542e38319f6be2a5d655cb2e0177f2f2` |
| `src/m.txt` | `14c445ebe5df985c8a6978f6564116b8bd4b62ef1911c81ba5198b5fe3abaa29` |
| `src/n.txt` | `62fb1ea6ff2d249f49f9cfcaf8adca8d00b5971a6368a6cc487eac59c92d1876` |
| `src/o.txt` | `fc4aeab64ae15dcb61b5a42ea58a4ea3756347a1727d1ad1b1a90dda430e6079` |
| `src/p.txt` | `b5f5c0fadd7830d3e4f3f9b3df6e38ece22945fe26b12dcf709e6f9ad50f64f1` |
| `src/q.txt` | `e1d590faacecaa4967f485e9cdeac035e1f6413e46781c62278941738cbc07a5` |
| `src/r.txt` | `114b44ca7ed8c712a9cec5f2e9673fbc6cabfaec7707ecbe2315d95fd01d4eb7` |
| `src/s.txt` | `150607935c835b2bf3d7a1c4ba9b49e9b036aeec3af6f2e30d2dbdd861656587` |
| `src/t.txt` | `5c7f9aeb8c35f692fc6dd7a9a5be65aeb168383c4342f268e9a080a8063d06d3` |
| `src/u.txt` | `e1459458ee52cc737d7d1f541f70ba6511fed098f2347eec5679c28102895333` |
| `src/v.txt` | `c58f41c5ee90f6bca2a77c415675aaf2c24cb1badb13280c212525ce1329947a` |
| `src/w.txt` | `cb7de2de0d35d213d37bacfed7c5865901cb7eb72c45de89c4d6eb90996327b8` |
| `src/x.txt` | `f5ef77ff89d6530721110eb13d9136af4c1c4586aa7d30b0e6943c9333c40129` |
| `src/y.txt` | `3ef6335676a78922073700d0d6a59b06949cc319c5e02699466aca7ebb1fdc21` |
| `src/z.txt` | `eafb461cfcaeb9a36e4d7d2cae967fa2b1f61bc0c2ab61c70f26fa06424c1f87` |

### 音声のモデルと声

kokoro-onnx のリリース `model-files-v1.1`（https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1 ）から取得しました。

| ファイル | 取得元 | SHA-256 |
|---|---|---|
| `kokoro-v1.0.onnx` | https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx （GitHub のリリースのファイル置き場へリダイレクト。ファイル名 `kokoro-v1.0.onnx`） | `beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a` |
| `voices-v1.0.bin` | https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin （同上。ファイル名 `voices-v1.0.bin`） | `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d` |

モデルと声のファイルはリポジトリに入れていません。作り直す人が各自取得します。

### ライセンスの全文

`LICENSE` は https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt （リダイレクトなし）から取得しました。SHA-256 は `28a9529c7d0bb4dc51f4bf5c116a3d16ef247a052f7591466768ddf563fd1cf5` です。

## 音声

- 声は `af_heart`、等速。単語はユニットごとに 1 ファイル（`demo-words-<ユニット>.m4a`）、例文はユニットごとに 10 文前後ずつ（`demo-examples-<ユニット>-<n>.m4a`）にまとめ、`audio`・`exampleAudio` の区間で指定しています。
- AAC-LC（`.m4a`）・モノラル。単語は 64 kbps、例文は 24 kbps。ffmpeg の内蔵の AAC エンコーダで圧縮しました。
- 読み上げた文・区間・ファイルごとの SHA-256、道具・ライブラリ・ffmpeg の版は、生成の記録 `audio-sources.json` にあります。
- 同じ綴りで読み方が変わる語（例: wind の名詞と動詞）は、例文の音声で意図した読み方になるように文を選びました。単語の音声は読み上げモデルの読み方のままです。

## 作り方

1. `node scripts/demo/check-demo.mjs --candidates` で、40 語の EJDict-hand の項目と訳語の候補の一覧を作りました。
2. 一覧と教材パックの形式（`docs/CONTENT_FORMAT.md`）をもとに、`items.json`・`manifest.json` を作りました。
3. `scripts/demo/make_audio.py make` で音声を作り、`verify` で作り直して確かめました。
4. `node scripts/demo/check-demo.mjs` で、選定・順序・訳・イディオム・太字・音声の記録を確かめました。

### 生成 AI を使ったこと

中身（用法の分け方・品詞・訳語の選択・例文・例文の訳・太字の部分・イディオムの選択）の下書きは、生成 AI（Anthropic の Claude。Claude Code から使用）に作らせ、道具での確かめを通しました。与えた指示の要点は次のとおりです。

- 材料は、NGSL の語と、その語の EJDict-hand の項目・訳語の候補の一覧と、教材パックの形式（`docs/CONTENT_FORMAT.md`）だけを使う。ほかの教材は参照しない。
- 訳・イディオムは、道具が出す EJDict-hand の候補から選ぶだけにする（言い換えない）。
- 用法は 1 語に 1〜3 つ。例文は 1 用法に 1 文、10〜15 語程度の自然な英文を新しく作る。例文と例文の訳は、辞書・教科書・Web にある文を写さず、辞書でよく見る決まった例文も使わない。
- `exampleTarget` は例文の中の見出し語の形、`exampleTranslationTarget` はその用法の訳語か、その活用した形にする。
- イディオムは、熟語の項目があるもののうち、見本になるものにだけ付ける。
- 形式の項目は、どれも 1 回以上使う。

## このデモを使う人へ

- **形式をまねるだけなら**: JSON の構造（項目の名前や入れ方）をまねて自分のデータを作るだけなら、このデモのライセンスは継承されません。
- **中身を流用して公開するなら**: このデモの見出し語の並び・訳・例文・例文の訳・音声を流用して公開する場合は、CC BY-SA 4.0 で公開し、上の出典（このデモ・NGSL・EJDict-hand・Kokoro-82M）を表示してください。
- **訳語だけなら**: 訳語は EJDict-hand（CC0 1.0）から取っているので、EJDict-hand から直接使うこともできます。
- **注意**: 市販の教材などを形式に変換したものは公開しないでください。これはライセンスの条件ではなく、権利者の著作物を公開しないための注意です。
