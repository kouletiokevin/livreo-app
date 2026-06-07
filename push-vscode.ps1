Set-Location "C:\Users\koule\Downloads\livreo-app"
$git = "C:\Program Files\Git\bin\git.exe"

# Supprimer le lock
$lock = ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "Lock supprime"
}

& $git add ".vscode\" "fix-defer.bat" "push-vscode.bat" "push-vscode.ps1"
& $git commit -m "config: vscode settings + extensions recommandees"
& $git push origin master
Write-Host "=== DONE ==="
Read-Host "Appuyer sur Entree"
