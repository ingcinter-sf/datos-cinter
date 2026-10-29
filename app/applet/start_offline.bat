@echo off
title CINTER - Control de Perforaciones (Modo Offline)
echo Iniciando servidor local para la aplicacion...
echo No cierre esta ventana mientras use el programa.
echo.
cd /d "%~dp0"
npx http-server dist -p 3000 -o
pause
