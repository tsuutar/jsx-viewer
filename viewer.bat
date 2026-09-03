@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js が見つかりません。
  echo Node.js LTS をインストールしてから再実行してください。
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

set "TARGET=%~1"

if not defined TARGET (
  for /f "usebackq delims=" %%I in (`powershell -NoProfile -STA -ExecutionPolicy Bypass -Command ^
    "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Filter='JSX / TSX / JavaScript|*.jsx;*.tsx;*.js;*.ts|All files|*.*'; $d.Title='表示する JSX / TSX ファイルを選択'; if($d.ShowDialog() -eq 'OK'){[Console]::Write($d.FileName)}"`) do set "TARGET=%%I"
)

if not defined TARGET (
  echo ファイルが選択されませんでした。
  exit /b 0
)

if not exist "%TARGET%" (
  echo.
  echo [ERROR] ファイルが見つかりません:
  echo %TARGET%
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

node viewer-server.mjs "%TARGET%"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] JSX Viewer が異常終了しました。終了コード: %RC%
  pause
)

exit /b %RC%
