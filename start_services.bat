@echo off
cd /d "e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\server"
echo Iniciando Backend...
start /B python app.py > nul

cd /d "e:\fcardene\Utiles\Repositorio_DevOps\Gestion-Personal\client"
echo Iniciando Frontend...
start /B npm run dev > nul

exit
