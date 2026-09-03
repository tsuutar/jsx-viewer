@echo off
setlocal EnableExtensions

rem ============================================================
rem JSX Viewer file association remover
rem Removes only the current-user registration created by
rem register-jsx-viewer.bat.
rem ============================================================

set "PROGID=ClaudeJSXViewer.jsx"

echo Removing JSX Viewer association...
echo.

reg delete "HKCU\Software\Classes\.jsx" /f >nul 2>nul
reg delete "HKCU\Software\Classes\%PROGID%" /f >nul 2>nul

ie4uinit.exe -show >nul 2>nul

echo.
echo Registration removed.
echo.
pause
