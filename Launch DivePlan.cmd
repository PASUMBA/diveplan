@echo off
setlocal
title DivePlan
where node.exe >nul 2>&1
if not errorlevel 1 (
  node.exe "%~dp0server.js" %*
) else if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" "%~dp0server.js" %*
) else (
  echo Install Node.js to use direct ESP32 upload. Opening the offline editor.
  start "" "%~dp0index.html"
  exit /b 0
)
if errorlevel 1 pause
