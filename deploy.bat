@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"
set GIT="C:\Program Files\Git\bin\git.exe"
if exist ".git\index.lock" del /f ".git\index.lock"
echo === Ajout des fichiers KolisGo ===
%GIT% add js/ index.html sw.js deploy.bat
echo === Commit ===
%GIT% commit -m "feat: compteur impact (eco + CO2) + confettis succes ; fix photos colis / QR destinataire / verif billet ; securite storage ; perfs RLS+index ; cache v31"
echo === Push GitHub master ===
%GIT% push origin master
echo.
echo Termine ! Rafraichis le site avec Ctrl+Shift+R dans ~1 minute.
pause
