@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if exist "%~dp0env.bat" call "%~dp0env.bat"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js ��������܂���B
  pause
  exit /b 1
)

set "TARGET=%~1"

if not defined TARGET (
  call server.bat
  exit /b %ERRORLEVEL%
)

if not exist "%TARGET%" (
  echo [ERROR] �t�@�C����������܂���:
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

rem PC��̊���JSX�̓A�b�v���[�h�����A���̏�Œ��ڊJ��
node local-viewer.mjs "%TARGET%"

exit /b %ERRORLEVEL%
