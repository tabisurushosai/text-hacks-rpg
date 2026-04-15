@echo off
chcp 65001 >nul
if exist "%~dp0PLAY.bat" (
  call "%~dp0PLAY.bat"
  exit /b %ERRORLEVEL%
)
cd /d "%~dp0"
title Text Descent - local server
echo.
echo [層底譚] PLAY.bat が見つかりません。ZIP を解凍し直すか README.txt を参照してください。
echo.
echo 手動: このフォルダで npx --yes serve . -l 3456 を実行し、ブラウザで http://localhost:3456 を開いてください。
echo.
npx --yes serve . -l 3456
echo.
pause
