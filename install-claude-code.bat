@echo off
echo ========================================
echo  Installation Claude Code pour KolisGo
echo ========================================
echo.

:: Verifier que Node.js est disponible
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas detecte.
    echo Veuillez redemarrer l'ordinateur puis relancer ce fichier.
    pause
    exit /b 1
)

echo [OK] Node.js detecte :
node --version

echo.
echo [1/3] Installation de Claude Code...
npm install -g @anthropic-ai/claude-code
if %errorlevel% neq 0 (
    echo [ERREUR] Installation echouee. Essai avec npx...
    goto :deploy
)

echo.
echo [OK] Claude Code installe !
echo.

:deploy
echo [2/3] Deploiement des corrections sur GitHub...
cd /d C:\Users\koule\Downloads\livreo-app
git add -A
git commit -m "fix: auth.js, poster.js, banner partenaires, CSS animation, swapGares null guard"
git push origin master

echo.
echo [3/3] Termine !
echo.
echo Netlify va deployer automatiquement dans 1-2 minutes.
echo Verifie sur : https://app.netlify.com
echo.
pause
