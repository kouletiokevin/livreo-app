@echo off
cd /d "C:\Users\koule\Downloads\livreo-app"

echo ========================================
echo   NETTOYAGE DINVMIC - FICHIERS INUTILES
echo ========================================
echo.

echo [1/3] Suppression des scripts de deploiement en double...
del /f /q fix-defer.bat 2>nul
del /f /q push-all.bat 2>nul
del /f /q push-vscode.bat 2>nul
del /f /q push-vscode.ps1 2>nul
del /f /q LIVREO_CLAUDE_CODE.md 2>nul
del /f /q android-build.md 2>nul
echo    OK

echo.
echo [2/3] Suppression des captures d'ecran (Bureau + Images + Telechargements)...
del /f /q "C:\Users\koule\Desktop\*.png" 2>nul
del /f /q "C:\Users\koule\Desktop\*.jpg" 2>nul
del /f /q "C:\Users\koule\Desktop\*.jpeg" 2>nul
del /f /q "C:\Users\koule\Pictures\Screenshots\*.png" 2>nul
del /f /q "C:\Users\koule\Pictures\Screenshots\*.jpg" 2>nul
del /f /q "C:\Users\koule\OneDrive\Images\Screenshots\*.png" 2>nul
del /f /q "C:\Users\koule\OneDrive\Images\Screenshots\*.jpg" 2>nul
del /f /q "C:\Users\koule\Downloads\*.png" 2>nul
del /f /q "C:\Users\koule\Downloads\*.jpg" 2>nul
del /f /q "C:\Users\koule\Downloads\*.jpeg" 2>nul
echo    OK

echo.
echo [3/3] Vider la Corbeille pour liberer l'espace disque...
PowerShell -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"
echo    OK

echo.
echo ========================================
echo   Nettoyage termine !
echo ========================================
echo.
pause
