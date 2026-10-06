@echo off
cd /d "%~dp0"
echo ArenaPro Stats - consola de publicacion
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo No se encontro Node.js en esta computadora.
  echo Instalalo desde https://nodejs.org ^(version LTS^) o con:
  echo   winget install OpenJS.NodeJS.LTS
  echo Luego cierra esta ventana y vuelve a abrir publicar.bat.
  echo.
  pause
  exit /b 1
)

REM Cierra instancia previa en 8787 (evita rebuild viejo en memoria).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8787" ^| findstr "LISTENING"') do (
  echo Cerrando proceso previo %%p en puerto 8787...
  taskkill /F /PID %%p >nul 2>&1
)

start "" "http://127.0.0.1:8787/admin.html"
node tools\publish-server.mjs
pause
