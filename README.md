# 英単語帳

スマホで使える、自分用の単語学習 PWA（開発中）。

## 教材データについて

このリポジトリには**教材データ（音声・単語リスト・訳など）は含まれていません**（下のデモ教材を除く）。
自分で用意した教材パックをアプリに取り込んで使います。形式は [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md)、作り方は [docs/CREATING_PACKS.md](docs/CREATING_PACKS.md) を参照してください。

### デモ教材

アプリの「デモを試す」で、デモ教材（20 語 × 2 ユニット）を読み込めます。教材を用意しなくてもアプリを試せ、教材パックの形式の見本にもなります。元のデータは [demo/](demo/) にあり、出典とライセンスは [demo/README.md](demo/README.md) に書いてあります。

## ライセンス

- コードは MIT（[LICENSE](LICENSE)）。
- デモ教材（`demo/`）は CC BY-SA 4.0（[demo/LICENSE](demo/LICENSE)）。材料の NGSL（CC BY-SA 4.0）・EJDict-hand（CC0 1.0）の出典は [demo/README.md](demo/README.md) を参照してください。

## 開発

必要なもの: Node.js 22.12 以上

```sh
npm install
npm run dev
```

clone した後は、コミット前のチェック（git フック）を有効にし、禁止語リストを作ってください（語がなければ空のファイルでかまいません。[docs/RULES.md](docs/RULES.md) 8 章）。

```sh
git config core.hooksPath scripts/git-hooks
touch .git/info/copyright-denylist
```

## ドキュメント

- [docs/RULES.md](docs/RULES.md) — 開発の基本ルール
- [docs/CREATING_PACKS.md](docs/CREATING_PACKS.md) — 自分のデータで教材パックを作る手順
- [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md) — 教材パックの形式
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 画面構成・フォルダ構成・データ構造・実装の順番
- [docs/specs/](docs/specs/) — 機能ごとの仕様書（暗記カード・デモ教材）
