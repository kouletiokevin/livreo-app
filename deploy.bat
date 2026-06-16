@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"
set GIT="C:\Program Files\Git\bin\git.exe"
if exist ".git\index.lock" del /f ".git\index.lock"
echo === Ajout des fichiers KolisGo ===
%GIT% add js/ admin/ index.html sw.js deploy.bat
echo === Commit ===
%GIT% commit -m "feat: admin detail colis + timeline + suppression moderation ; colis acceptes masques ; header auto-masquant ; badge certif avatar ; acceptation sans billet ; cache v34"
echo === Push GitHub master ===
%GIT% push origin master
echo.
echo Termine ! Rafraichis avec Ctrl+Shift+R dans ~1 minute.
pause
