@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js が見つかりません。
  echo https://nodejs.org/ から Node.js LTS をインストールしてください。
  pause
  exit /b 1
)

call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install に失敗しました。
  pause
  exit /b 1
)

echo.
echo セットアップ完了。
echo JSX ファイルを viewer.bat にドラッグ＆ドロップして開けます。
echo.
pause
