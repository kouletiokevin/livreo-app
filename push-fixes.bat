@echo off
echo Suppression du verrou git...
del /f /q "%~dp0.git\index.lock" 2>nul
cd /d C:\Users\koule\Downloads\livreo-app
git add -A
git commit -m "fix: splash instant, nav labels, email fallback, sticky partner ticker, admin role"
git push origin master
echo.
echo Deploiement envoye sur GitHub Pages !
pause
