@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"
set GIT="C:\Program Files\Git\bin\git.exe"
if exist ".git\index.lock" del /f ".git\index.lock"
%GIT% add .vscode\ fix-defer.bat index.html
%GIT% commit -m "config: vscode settings + extensions recommandees"
%GIT% push origin master
echo === Done ===
pause
