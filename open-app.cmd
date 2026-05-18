@echo off
cd /d "%~dp0"
start "" "http://localhost:4173"
"F:\nodejs\node.exe" server.mjs
pause
