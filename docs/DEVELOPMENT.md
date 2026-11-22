# 開発の作業手順

このアプリを開発する人向けの作業手順。決まりの本文は `docs/RULES.md`、設計は `docs/ARCHITECTURE.md`・`docs/specs/` にあり、この文書はそれを参照する（文書の役割の分け方は `docs/RULES.md` 7 章）。

## 1. 環境の用意

必要なもの: Node.js 22.12 以上。デモ教材の音声を作るときだけ、Python 3.11 以降と ffmpeg（`scripts/demo/README.md`）。

```sh
npm install
npm run dev
```

clone した後は、コミット前のチェック（git フック、`docs/RULES.md` 8 章）を有効にし、禁止語リストを作る。語がなければ空のファイルでよい（リストがないと、フックはコミットを止める）。

```sh
git config core.hooksPath scripts/git-hooks
touch .git/info/copyright-denylist
```

配信（`docs/RULES.md` 3 章）を初めて用意するときは、リポジトリの Settings → Pages → Build and deployment の Source を「GitHub Actions」にする。

## 2. レビューとコミット

- 実装の区切りとコミットの前に、`code-reviewer` でレビューする。コミットの前には `copyright-reviewer` でレビューし、PASS のときだけコミットできる（`docs/RULES.md` 8 章・10 章）。
- 手順の本文（コミットの分け方、ステージの仕方、承認の扱い、lint・test・build の確かめ）は `CLAUDE.md` の「コードレビュー」「コミット手順」にある（人も AI も従う。`docs/RULES.md` 7 章）。

## 3. 実装の進み具合

`docs/ARCHITECTURE.md` 6 章の実装の順番に対して:

- 手順 1〜8: 済み。手順 7 のテストは、手順 6 より先に作った（テストは手順 6 に依存しないため）。手順 7 の復習は、手順 6 の判定を使うため、手順 6 の後に足した。
- 手順 9（学習記録のエクスポート / インポート、教材パックの zip の書き出しと、解説の誤りの報告の一覧）: 残り。仕様（`docs/specs/backup.md`）は決定済み。学習記録のエクスポートは済み。教材パックの zip の書き出し・3 通りの選び方・学習記録のインポート・報告の一覧は残り。
- 手順 10（デモ教材）: 済み。手順 9 より先に進めた（デモ教材の仕様を決めた時期に合わせたため）。ビルドでの zip 化と画面はデモの中身より先に作った（中身がなければ何もしない作りにしてある）。
- 実装の順番にないもの: 教材パックを削除する機能はまだない（未決事項。`docs/RULES.md` 12 章）。

## 4. デモ教材の中身を作る

デモ教材（`demo/`）の中身を作る・作り直すときの手順。決まりは `docs/RULES.md` 11 章、作るものと確かめ方は `docs/specs/demo-pack.md`。

作る作業は git worktree で行い、照らし合わせとコミットは元のリポジトリで行う。worktree は作る場所としてだけ使う（`docs/RULES.md` 11 章「手元の教材を混ぜないための決まり」）。

### worktree の用意

1. 道具（`docs/specs/demo-pack.md` 3・4 章）をコミットした後の `main` から、元のリポジトリで `git worktree add --detach <パス> main` を実行する（ブランチは作らない。コミットは元のリポジトリで行うため）。
   - パスはリポジトリの外で、上のフォルダに `CLAUDE.md`・`CLAUDE.local.md` がなく、英数字だけからなる場所にする（Claude Code は上のフォルダの `CLAUDE.md`・`CLAUDE.local.md` も読み込むため。また、英数字以外の文字を含むパスは、Claude Code のプロジェクトごとのフォルダの名前が置き換えられ、ほかのプロジェクトと重なることがあるため）。
   - Claude Code の組み込みの worktree 機能（リポジトリの中に作るもの）は使わない。
2. worktree に、Claude Code の設定（`.claude/settings.local.json`。Git 管理外）を置く。
   - 自動メモリを切る（同じリポジトリの worktree では、自動メモリが共有されるため）。
   - 元のリポジトリの `data/`・`private/`・`CLAUDE.local.md`・`.git/info/` を読むことを禁止する。
3. worktree の作業の場（生成 AI の会話）は新しく始める。元のリポジトリの以前の会話を開き直さない。
4. Git 管理外のファイル（`data/`・`private/`・`CLAUDE.local.md` など）は、worktree に写さない。

### 作る（worktree の中で行う）

5. `node scripts/demo/check-demo.mjs --candidates` で、NGSL 1.2 と EJDict-hand を決めた版で取得し、40 語それぞれの EJDict-hand の見出し語の項目・使える熟語の項目・訳語の候補の一覧を作る（`docs/specs/demo-pack.md` 3 章）。
6. 中身を作る。作る担当には、5 の一覧と、教材パックの形式（`docs/CONTENT_FORMAT.md`）だけを渡す。
   - 作るもの: 用法の分け方、品詞、訳（訳語の候補から選ぶ）、例文、`exampleTarget`、例文の訳と太字の部分、イディオム（熟語の項目から選ぶ）。
   - 生成 AI に手伝わせるときに与えた指示の要点を、`demo/README.md` に書く。
7. 音声を作る道具（`docs/specs/demo-pack.md` 4 章、`scripts/demo/README.md`）で、単語と例文の音声を作り、`verify` で確かめる。
8. 中身を確かめる道具（`node scripts/demo/check-demo.mjs`）を通す。`demo/README.md`・`demo/LICENSE` を書く。

### 照らし合わせとコミット（元のリポジトリで行う）

9. worktree の `demo/` を、元のリポジトリの `demo/` に写す。
10. 元のリポジトリで、手元の教材との照らし合わせを行う（手順は非公開）。
    - 似たものが見つかったら、その項目を捨てる。worktree の作業には、捨てる項目の単語の `id`・用法の番号・項目名だけを伝える（似ていた手元の文や理由は伝えない）。worktree で 6 からやり直し、9 から進め直す。
11. 元のリポジトリで、「2. レビューとコミット」のとおりにレビューし、コミットする。git フック・禁止語リスト・`copyright-reviewer`・承認の記録は、元のリポジトリでそのまま働く。
12. 済んだら worktree を消す（`git worktree remove`）。

- 中身を直したら、7（英文を変えたとき）・8・10 をやり直す（決まりは `docs/specs/demo-pack.md` 2 章）。
