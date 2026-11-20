# 教材パック形式（ドラフト）

アプリが取り込む教材パックの形式。実装前のドラフトで、設計時に確定させる。
**このファイルには形式だけを書き、実際の教材の中身は書かない。**

## パックの構成

```
my-pack.zip
├── manifest.json   # パックの情報
├── items.json      # 単語（学習項目）の一覧
└── audio/          # 音声ファイル
    ├── track-01.mp3
    └── ...
```

## manifest.json

```json
{
  "formatVersion": 1,
  "id": "my-vocab-pack",
  "title": "自分用単語パック",
  "createdAt": "2026-11-20"
}
```

- `id`: パックを識別する文字列。同じ `id` のパックを再度取り込んだら更新として扱う。

## items.json

```json
[
  {
    "id": "0001",
    "word": "example",
    "meaning": "例",
    "example": "This is an example sentence.",
    "audio": { "file": "track-01.mp3", "start": 1.2, "end": 3.8 },
    "tags": ["unit1"]
  }
]
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `id` | ○ | 安定した ID。学習記録はこの ID で紐づくため、一度決めたら変えない |
| `word` | ○ | 見出し語 |
| `meaning` | | 訳 |
| `example` | | 例文 |
| `audio.file` | | `audio/` 内のファイル名 |
| `audio.start` / `audio.end` | | 再生区間（秒）。省略時はファイル全体 |
| `tags` | | 絞り込み用の任意のタグ |

## 学習記録（参考）

学習記録は教材パックとは別に端末内に保存し、`id` で参照する。
エクスポート形式は設計時に決める。
