#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export PATH="${HOME}/.n/bin:${HOME}/.npm-global/bin:${PATH}"

PORT="${PORT:-5173}"
export PORT

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请安装 Node.js 18+。"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "当前 Node: $(node -v)，需要 Node 18+。"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "正在安装依赖..."
  if [ -f package-lock.json ]; then
    npm install
  elif command -v pnpm >/dev/null 2>&1; then
    pnpm install
  else
    npm install
  fi
fi

echo "启动 todolist 开发服务器..."
echo "首选端口: ${PORT}（若被占用，Vite 会自动尝试下一端口）"
echo "示例: http://127.0.0.1:${PORT}/"

if [ -f package-lock.json ]; then
  exec npm run dev -- --host 127.0.0.1 --port "${PORT}"
elif command -v pnpm >/dev/null 2>&1; then
  exec pnpm dev --host 127.0.0.1 --port "${PORT}"
else
  exec npm run dev -- --host 127.0.0.1 --port "${PORT}"
fi
