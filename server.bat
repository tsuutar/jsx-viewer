@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js が見つかりません。
  echo Node.js LTS をインストールしてください。
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\esbuild" (
  echo.
  echo 初回セットアップ: npm パッケージをインストールしています...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install に失敗しました。
    pause
    exit /b 1
  )
)

node server.mjs

echo.
echo JSX Viewer Server を終了しました。
pause
