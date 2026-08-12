# Starts the full Lickyeat dev stack (dev-mongo, API, Metro, Android emulator) if any
# part of it isn't already running, then launches/reloads the app on the emulator.
# Double-click run-app.bat in this same folder to run this without opening a terminal.

$RepoRoot = "D:\TBC app"
$AndroidHome = "D:\SDK location"
$Adb = "$AndroidHome\platform-tools\adb.exe"
$Emulator = "$AndroidHome\emulator\emulator.exe"
$AvdName = "Pixel_7"

function Test-PortListening($port) {
    return $null -ne (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

Write-Host "=== Lickyeat dev stack launcher ===" -ForegroundColor Cyan

# 1. dev-mongo
if (-not (Test-PortListening 27117)) {
    Write-Host "Starting dev-mongo..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RepoRoot\apps\api'; pnpm run dev:mongo"
    Start-Sleep -Seconds 5
} else {
    Write-Host "dev-mongo already running." -ForegroundColor Green
}

# 2. API server
if (-not (Test-PortListening 4000)) {
    Write-Host "Starting API server..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RepoRoot\apps\api'; pnpm run dev"
    Start-Sleep -Seconds 5
} else {
    Write-Host "API server already running." -ForegroundColor Green
}

# 3. Metro bundler
if (-not (Test-PortListening 8081)) {
    Write-Host "Starting Metro bundler..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RepoRoot\apps\mobile'; pnpm exec expo start"
    Write-Host "Waiting for Metro to come up..." -ForegroundColor Yellow
    Start-Sleep -Seconds 12
} else {
    Write-Host "Metro already running." -ForegroundColor Green
}

# 3.5. dev-mongo is in-memory and loses all data on every restart - if the API is up but
# the DB is empty (e.g. dev-mongo got restarted earlier in this terminal session), the app
# would otherwise load to a blank "coming soon" screen with no explanation. Reseed automatically.
try {
    $brandCheck = Invoke-RestMethod -Uri "http://localhost:4000/brands" -TimeoutSec 5
    if ($brandCheck.brands.Count -eq 0) {
        Write-Host "Dev database is empty - reseeding..." -ForegroundColor Yellow
        Push-Location "$RepoRoot\apps\api"
        pnpm run seed
        Pop-Location
    } else {
        Write-Host "Dev database already seeded." -ForegroundColor Green
    }
} catch {
    Write-Host "Could not check dev database state - continuing anyway." -ForegroundColor Yellow
}

# 4. Emulator
$devices = & $Adb devices
if ($devices -notmatch 'device\s*$') {
    Write-Host "Starting emulator (can take 30-90s)..." -ForegroundColor Yellow
    Start-Process -FilePath $Emulator -ArgumentList "-avd", $AvdName, "-gpu", "swiftshader_indirect"

    $booted = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 3
        $state = (& $Adb get-state 2>$null)
        $bootProp = (& $Adb shell getprop sys.boot_completed 2>$null)
        if ($state -eq "device" -and $bootProp -match "1") {
            $booted = $true
            break
        }
    }
    if (-not $booted) {
        Write-Host "Emulator didn't finish booting in time - check the emulator window manually." -ForegroundColor Red
        exit 1
    }
    Write-Host "Emulator booted." -ForegroundColor Green
} else {
    Write-Host "Emulator already running." -ForegroundColor Green
}

# 5. Forward ports + launch/reload the app
& $Adb reverse tcp:4000 tcp:4000
& $Adb reverse tcp:8081 tcp:8081
& $Adb shell am force-stop host.exp.exponent
Start-Sleep -Seconds 1
& $Adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" | Out-Null

Write-Host "Lickyeat app launched on the emulator." -ForegroundColor Cyan
