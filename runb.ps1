# Run SEROS Backend
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting S.E.R.O.S. Django Backend" -ForegroundColor Green
Write-Host "📡 ESP32 URL: http://192.168.137.52 (configured directly in code)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\newBackend"
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    .\.venv\Scripts\Activate.ps1
}
python manage.py runserver 0.0.0.0:8000
