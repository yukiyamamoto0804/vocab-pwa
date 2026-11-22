# デモ教材を作る道具

公開するデモ教材（`demo/`）を作り、確かめる道具。決まりは `docs/RULES.md` 11 章、手順は `docs/specs/demo-pack.md` にある。
開発のときだけ使い、アプリ本体と配信物には含めない。

| ファイル | 内容 | 必要なもの |
|---|---|---|
| `check-demo.mjs` | 中身（選定・順序・訳・イディオム・太字・音声の記録・README の版の記載）を確かめる。`--candidates` で訳語の候補の一覧を出す | Node.js |
| `make_audio.py` | 単語と例文の音声を作り、区間を `items.json` に書き込む（`make`）。作り直して記録と合うかを確かめる（`verify`） | Python 3、`requirements.txt` の依存、ffmpeg |

## 中身を確かめる

```sh
node scripts/demo/check-demo.mjs              # demo/ を確かめる
node scripts/demo/check-demo.mjs --candidates # 40 語と熟語の訳語の候補を JSON で出す
```

- 材料（NGSL 1.2 と EJDict-hand）は、固定した版を初回に配布元から取得して `.cache/`（Git 管理外）に置く。SHA-256 が違えば止まる。
- git フックは、`demo/` か `scripts/demo/` を変えたコミットのたびに、ステージの内容でこの確かめを行う。

## 音声を作る

Python 3.11 以降が必要。

```sh
python3 -m venv .venv-demo
.venv-demo/bin/pip install -r scripts/demo/requirements.txt
.venv-demo/bin/python -I -B scripts/demo/make_audio.py make   --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin>
.venv-demo/bin/python -I -B scripts/demo/make_audio.py verify --model <kokoro-v1.0.onnx> --voices <voices-v1.0.bin>
```

- 読み上げのモデルと声のファイルは、kokoro-onnx が配布している変換版（https://github.com/thewh1teagle/kokoro-onnx/releases ）を各自取得する。リポジトリには入れない。
- ffmpeg は各自インストールする。圧縮には内蔵の AAC エンコーダを使う。
- `make` は `demo/audio/` の `demo-*.m4a` を作り直し、`demo/items.json` の `audio`・`exampleAudio` と、生成の記録 `demo/audio-sources.json` を書き換える。全部を作り終えてから置き換えるので、途中で失敗しても前の音声と記録は残る。
- `verify` は、記録の文を読み上げ直して `make` と同じ処理をし、記録の長さ・区間と 0.05 秒以内で合うかを確かめる。`make` と同じモデル・声のファイルが必要（SHA-256 が違えば止まる）。
- 中身を直したら、`make` → `check-demo.mjs` の順にやり直す。`make` は `items.json` を書き換えるので、手元の教材との照らし合わせもやり直す（`docs/specs/demo-pack.md` 2 章）。
- 生成の記録には、道具・ライブラリ・ffmpeg（と libavcodec）の版の番号と、ファイルの SHA-256 を書く。ビルドの設定やインストール先のパスは書かない。

## ライセンス

- 道具のコードは MIT（リポジトリの `LICENSE`）。
- 依存のライセンスは `requirements.txt` の先頭に書いた。phonemizer と、espeakng-loader の wheel が含む espeak-ng は GPL-3.0-or-later。soundfile の wheel が含む libsndfile は LGPL-2.1-or-later（その中に LGPL・BSD のライブラリも含む。詳細は wheel の licensing/license_notes.md）。道具は読み込むだけで同梱しない。生成した音声には、これらのライセンスは及ばない。
- `fixtures/ejdict-demo-lines.txt` は EJDict-hand（CC0 1.0）の行を抜き出したもの。
