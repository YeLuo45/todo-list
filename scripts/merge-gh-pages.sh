#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export GIT_MERGE_AUTOEDIT=no

echo "=== 合并 gh-pages 到当前分支 ==="
git status -sb

if git merge gh-pages -m "merge: integrate todo-list gh-pages"; then
  echo "合并完成"
elif git merge gh-pages --allow-unrelated-histories -m "merge: integrate todo-list gh-pages"; then
  echo "合并完成 (allow-unrelated-histories)"
else
  echo "合并失败，请检查冲突:"
  git diff --name-only --diff-filter=U || true
  exit 1
fi

git status -sb
git log -1 --oneline
