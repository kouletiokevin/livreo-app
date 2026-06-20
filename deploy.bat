@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"
set GIT="C:\Program Files\Git\bin\git.exe"
if exist ".git\index.lock" del /f ".git\index.lock"
echo === Ajout de TOUS les fichiers DINVMIC ===
%GIT% add -A
echo === Commit ===
%GIT% commit -m "MAJ DINVMIC : corrections + nouvelles fonctionnalites"
echo === Push GitHub master ===
%GIT% push origin master
echo.
echo Termine ! Rafraichis le site avec Ctrl+Shift+R dans ~1 minute.
pause
