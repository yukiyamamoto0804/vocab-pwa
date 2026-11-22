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

## ドキュメント

使う人・自分のデータを作る人・デモ教材の道具を使う人へ:

- [docs/CREATING_PACKS.md](docs/CREATING_PACKS.md) — 自分のデータで教材パックを作る手順
- [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md) — 教材パックの形式
- [demo/README.md](demo/README.md) — デモ教材の出典・ライセンス・作り方
- [scripts/demo/README.md](scripts/demo/README.md) — デモ教材の道具（中身の確かめ・音声の作成）の使い方

開発する人へ:

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — 開発の作業手順（環境の用意・レビューとコミット・実装の進み具合・デモ教材の中身を作る手順）
- [docs/RULES.md](docs/RULES.md) — 開発の基本ルール
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 画面構成・フォルダ構成・データ構造・実装の順番
- [docs/specs/](docs/specs/) — 機能ごとの仕様書（暗記カード・デモ教材）
