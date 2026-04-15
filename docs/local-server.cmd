@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 層底譚 — ローカルサーバ
echo この窓を閉じるとゲームの配信が止まります。
npx --yes serve . -l 3456
