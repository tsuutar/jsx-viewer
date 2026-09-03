@echo off
setlocal EnableExtensions

rem ============================================================
rem JSX Viewer file association installer
rem Registers .jsx for the current Windows user only.
rem No administrator privileges required.
rem ============================================================

set "VIEWER_BAT=C:\dev\jsx-viewer\viewer.bat"
set "PROGID=ClaudeJSXViewer.jsx"

if not exist "%VIEWER_BAT%" (
    echo [ERROR] viewer.bat was not found:
    echo %VIEWER_BAT%
    echo.
    pause
    exit /b 1
)

echo Registering .jsx association...
echo.

rem Associate .jsx with our custom ProgID
reg add "HKCU\Software\Classes\.jsx" /ve /d "%PROGID%" /f >nul
if errorlevel 1 goto :ERROR

rem Friendly name
reg add "HKCU\Software\Classes\%PROGID%" /ve /d "JSX File" /f >nul
if errorlevel 1 goto :ERROR

rem Default icon
rem Uses the viewer batch file icon fallback via cmd.exe.
reg add "HKCU\Software\Classes\%PROGID%\DefaultIcon" /ve /d "%%SystemRoot%%\System32\cmd.exe,0" /f >nul
if errorlevel 1 goto :ERROR

rem Double-click action
rem %1 must be quoted because JSX paths may contain spaces.
reg add "HKCU\Software\Classes\%PROGID%\shell\open\command" /ve /d "\"%VIEWER_BAT%\" \"%%1\"" /f >nul
if errorlevel 1 goto :ERROR

rem Notify Explorer that file associations changed
ie4uinit.exe -show >nul 2>nul

echo.
echo Registration completed.
echo.
echo Double-clicking a .jsx file will now execute:
echo "%VIEWER_BAT%" "JSX_FILE_PATH"
echo.
echo If Windows still opens another application, use:
echo   Right-click .jsx ^> Open with ^> Choose another app
echo and select the JSX Viewer once.
echo.
pause
exit /b 0

:ERROR
echo.
echo [ERROR] Registry registration failed.
echo.
pause
exit /b 1
