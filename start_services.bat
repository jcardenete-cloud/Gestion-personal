@echo off
cd /d "%~dp0server"
echo Iniciando Backend...
start /B python app.py > nul

cd /d "%~dp0client"
echo Iniciando Frontend...
start /B npm run dev > nul

exit
