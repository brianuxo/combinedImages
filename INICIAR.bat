@echo off
setlocal
cd /d "%~dp0"

title Combined - Vite + React

rem ---------------------------------------------------------------
rem  Lanzador de Windows: abre la consola y ejecuta iniciar.sh
rem  (la consola se queda abierta al terminar, gestionado por el trap)
rem ---------------------------------------------------------------

set "BASH="
where bash >nul 2>&1 && set "BASH=bash"
if not defined BASH if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"

if not defined BASH (
  echo ERROR: no se encontro Git Bash.
  echo Instala Git for Windows o anade bash al PATH.
  echo.
  pause
  exit /b 1
)

if not exist "%~dp0iniciar.sh" (
  echo ERROR: falta iniciar.sh en %~dp0
  echo.
  pause
  exit /b 1
)

"%BASH%" "%~dp0iniciar.sh" %*
