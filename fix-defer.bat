@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"
set GIT="C:\Program Files\Git\bin\git.exe"
if exist ".git\index.lock" del /f ".git\index.lock"
%GIT% add index.html sw.js
%GIT% commit -m "fix: retirer defer des CDN scripts (causait db is not defined)"
%GIT% push origin master
echo === Deploye ! ===
pause
