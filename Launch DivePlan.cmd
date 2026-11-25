@echo off
setlocal DisableDelayedExpansion
title DivePlan

set "DIVEPLAN_APP=%~dp0"
if exist "%DIVEPLAN_APP%server.js" goto check_files
if exist "%~dp0DivePlan\server.js" (
  set "DIVEPLAN_APP=%~dp0DivePlan\"
  goto check_files
)
if exist "%~dp0DivePlan-Windows\DivePlan\server.js" (
  set "DIVEPLAN_APP=%~dp0DivePlan-Windows\DivePlan\"
  goto check_files
)
goto missing_files

:check_files
for %%F in (app.js index.html mission.js scene.js style.css) do (
  if not exist "%DIVEPLAN_APP%%%F" goto missing_files
)
set "DIVEPLAN_NODE="
if exist "%ProgramFiles%\nodejs\node.exe" set "DIVEPLAN_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined DIVEPLAN_NODE for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined DIVEPLAN_NODE set "DIVEPLAN_NODE=%%N"
if not defined DIVEPLAN_NODE goto offline
"%DIVEPLAN_NODE%" -e "process.exit(+process.versions.node.split('.')[0] >= 20 ? 0 : 1)" >nul 2>&1
if errorlevel 1 goto offline
"%DIVEPLAN_NODE%" "%DIVEPLAN_APP%server.js" %*
if not errorlevel 1 exit /b 0
echo.
echo DivePlan could not start. See the error above.
pause
exit /b 1

:offline
echo Node.js 20 or newer is needed for local ESP32 upload. Opening the offline editor.
start "" "%DIVEPLAN_APP%index.html"
exit /b 0

:missing_files
echo DivePlan needs all of the files in its Windows ZIP.
echo Right-click DivePlan-Windows.zip, select Extract All, and open the extracted DivePlan folder.
echo Double-click Launch DivePlan.cmd inside that folder.
echo Download: https://pasumba.github.io/diveplan/DivePlan-Windows.zip
pause
exit /b 1
