@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"
set GIT="C:\Program Files\Git\bin\git.exe"

echo Suppression du lock git si present...
if exist ".git\index.lock" del /f ".git\index.lock"

echo.
echo === Ajout de tous les fichiers en attente ===
%GIT% add .vscode\settings.json
%GIT% add .vscode\extensions.json
%GIT% add index.html
%GIT% add fix-defer.bat
%GIT% add push-vscode.bat
%GIT% add push-vscode.ps1
%GIT% add push-all.bat

echo.
echo === Commit ===
%GIT% commit -m "config: vscode settings + extensions recommandees + scripts deploy"

echo.
echo === Push vers GitHub (master) ===
%GIT% push origin master

echo.
echo === Termine ! ===
pause
