@echo off
cd /d "%~dp0backend"
echo Starting Modern Skills API server on http://localhost:3000 ...
node server.js
pause
