@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"

set GIT="C:\Program Files\Git\bin\git.exe"

echo Suppression du lock git si present...
if exist ".git\index.lock" del /f ".git\index.lock"

echo.
echo === Ajout de tous les fichiers ===
%GIT% add -A

echo.
echo === Commit ===
%GIT% commit -m "feat: admin panel complet, dashboard fix localStorage, badge certif photo, sw cache v8"

echo.
echo === Push vers GitHub (master) ===
%GIT% push origin master

echo.
echo === Termine ! Netlify va deployer automatiquement. ===
pause
