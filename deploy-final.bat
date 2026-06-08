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
%GIT% commit -m "fix: null-style crashes + security audit - add null guards app/suivi/booster/explorer/livreur, fix XSS+open-redirect in partners banner, tighten CSP, X-XSS-Protection header, SW v12 with affil.js"

echo.
echo === 