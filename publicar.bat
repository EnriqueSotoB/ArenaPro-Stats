@echo off
cd /d "%~dp0"
echo ArenaPro Stats — consola de publicacion
echo.
start "" "http://127.0.0.1:8787/admin.html"
node scripts\publish-server.mjs
pause
