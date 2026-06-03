@echo off
setlocal EnableDelayedExpansion

echo Buscando procesos en los puertos 5000 (Backend) y 5173 (Frontend)...

set FOUND=0

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo Matando proceso Backend con PID %%a
    taskkill /f /pid %%a
    set FOUND=1
)

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Matando proceso Frontend con PID %%a
    taskkill /f /pid %%a
    set FOUND=1
)

if !FOUND! == 0 (
    echo No se encontraron procesos activos en los puertos 5000 o 5173.
) else (
    echo.
    echo Aplicacion detenida con exito.
)

echo.
timeout /t 3
exit
