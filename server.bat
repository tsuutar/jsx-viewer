@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
if exist "%~dp0env.bat" call "%~dp0env.bat"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js ��������܂���B
  echo Node.js LTS ���C���X�g�[�����Ă��������B
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\esbuild" (
  echo.
  echo ����Z�b�g�A�b�v: npm �p�b�P�[�W���C���X�g�[�����Ă��܂�...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install �Ɏ��s���܂����B
    pause
    exit /b 1
  )
)

node server.mjs

echo.
echo JSX Viewer Server ���I�����܂����B
pause
