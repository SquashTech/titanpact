@echo off
title Titanpact
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies the first time this runs...
  ".node-runtime\node-v24.19.0-win-x64\npm.cmd" install
)

echo Starting Titanpact...
echo Your browser will open automatically. Close this window to stop the server.
".node-runtime\node-v24.19.0-win-x64\node.exe" node_modules\vite\bin\vite.js --open
