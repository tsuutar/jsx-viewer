@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js が見つかりません。
  pause
  exit /b 1
)

set "TARGET=%~1"

if not defined TARGET (
  call server.bat
  exit /b %ERRORLEVEL%
)

if not exist "%TARGET%" (
  echo [ERROR] ファイルが見つかりません:
  echo %TARGET%
  pause
  exit /b 1
)

if not exist "node_modules\esbuild" (
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

rem PC上の既存JSXはアップロードせず、その場で直接開く
node local-viewer.mjs "%TARGET%"

exit /b %ERRORLEVEL%
