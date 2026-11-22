#!/bin/sh
# 著作権レビューの承認マーカーを書き込む（copyright-reviewer エージェントが PASS のときだけ実行する）。
# 現在のステージ内容（ツリーのハッシュ）に対する承認になる。ステージ内容が変わると、
# pre-commit フックが承認なしとしてコミットを止める。
# Claude Code の許可ルールに当てはまるよう、呼び出す側のコマンドを固定の 1 行にするためのスクリプト
set -eu

git_dir=$(git rev-parse --git-dir)
# 先にハッシュを求めてから書き込む（ステージに未解決の衝突があって失敗したとき、マーカーを空にしないため）
tree=$(git write-tree)
printf '%s\n' "$tree" > "$git_dir/copyright-review-approved"
