@echo off
setlocal
cd /d "%~dp0"
title Akashic Records

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and run this launcher again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Opening Akashic Records...
call npm start
if errorlevel 1 (
  echo.
  echo The app exited with an error.
  pause
  exit /b 1
)
