@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Text Descent - local server
echo.
echo [層底譚] 簡易起動（Node.js がパソコンに入っている必要があります）
echo.
echo 1. 下に URL が出たら、ブラウザで http://localhost:3456 を開いてください。
echo 2. 終了するときはこの黒い画面を閉じるか、Ctrl+C を押してください。
echo.
echo 初回は npx のダウンロードに数十秒かかることがあります。
echo.
npx --yes serve . -l 3456
echo.
pause
