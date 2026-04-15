#!/bin/bash
cd "$(dirname "$0")"

if ! command -v npx >/dev/null 2>&1; then
  osascript -e 'display alert "Node.js が必要です" message "https://nodejs.org/ の LTS を入れてから、もう一度 PLAY.command をダブルクリックしてください。"' 2>/dev/null || echo "Node.js が必要です。README.txt を参照してください。"
  exit 1
fi

echo ""
echo "[層底譚] ブラウザを開きます…（初回は npx の取得に時間がかかることがあります）"
echo "終了するときは、このターミナルで Ctrl+C を押すか、ウィンドウを閉じてください。"
echo ""

npx --yes serve . -l 3456 &
SERVE_PID=$!

sleep 12
open "http://localhost:3456" 2>/dev/null || xdg-open "http://localhost:3456" 2>/dev/null || true

wait "$SERVE_PID"
