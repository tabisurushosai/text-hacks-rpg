@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。
  echo https://nodejs.org/ から LTS をインストールしてから、もう一度このファイルをダブルクリックしてください。
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0local-server.cmd" (
  echo local-server.cmd が見つかりません。ZIP を解凍し直してください。
  pause
  exit /b 1
)

echo.
echo [層底譚] ブラウザを開きます…（初回は npx の取得に数十秒かかることがあります）
echo 終了するときは、タスクバーの「層底譚 — ローカルサーバ」と書いた黒い窓を閉じてください。
echo.

start "層底譚-serve" /MIN "%~dp0local-server.cmd"

:: npx の初回ダウンロード待ち（遅い PC 向けに少し長め）
timeout /t 10 /nobreak >nul
start "" "http://localhost:3456"

exit /b 0
