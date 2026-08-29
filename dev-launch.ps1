# One-shot cold start for the TBC app dev stack: boots the emulator (if needed), starts the
# in-memory dev Mongo and re-seeds it, starts the API and Metro bundler, forwards the adb ports,
# and opens the app on the emulator. Safe to re-run - every step first checks whether it's
# already up and skips it if so, so mashing the shortcut key never spawns duplicate processes.
# Bound to Ctrl+Shift+P via the VS Code task "Run Dev Server" (see .vscode/tasks.json and the
# user keybindings.json entry) - deliberately overrides the Command Palette shortcut, by request.

$root = $PSScriptRoot
$sdk = "D:\SDK location"
$adb = "$sdk\platform-tools\adb.exe"
$emulator = "$sdk\emulator\emulator.exe"
$avdName = "Pixel_7"

function Test-Port($portNumber) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $portNumber)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-Port($portNumber, $label, $timeoutSeconds = 90) {
    $elapsed = 0
    while (-not (Test-Port $portNumber)) {
        if ($elapsed -ge $timeoutSeconds) {
            Write-Host "Timed out waiting for $label (port $portNumber)." -ForegroundColor Red
            return $false
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Write-Host "$label is up (port $portNumber)." -ForegroundColor Green
    return $true
}

# 1. Emulator
$devices = & $adb devices
$hasDevice = $false
foreach ($line in $devices) {
    if ($line -match "\tdevice$") { $hasDevice = $true }
}
if (-not $hasDevice) {
    Write-Host "Starting emulator ($avdName)..." -ForegroundColor Cyan
    Start-Process -FilePath $emulator -ArgumentList "-avd", $avdName, "-netdelay", "none", "-netspeed", "full" -WindowStyle Minimized
    & $adb wait-for-device
    Write-Host "Waiting for boot to finish..." -ForegroundColor Cyan
    do {
        Start-Sleep -Seconds 3
        $booted = (& $adb shell getprop sys.boot_completed).Trim()
    } while ($booted -ne "1")
    Write-Host "Emulator booted." -ForegroundColor Green
} else {
    Write-Host "Emulator already running." -ForegroundColor Green
}

# 2. Dev Mongo (in-memory) - always safe to leave running if already up.
if (-not (Test-Port 27117)) {
    Write-Host "Starting dev Mongo..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm run dev:mongo" -WorkingDirectory "$root\apps\api" -WindowStyle Minimized
    Wait-Port 27117 "Mongo" | Out-Null
} else {
    Write-Host "Mongo already running." -ForegroundColor Green
}

# 3. Seed - idempotent, always safe to re-run (only resets catalog/coupon data, never users/orders).
Write-Host "Seeding..." -ForegroundColor Cyan
Push-Location "$root\apps\api"
pnpm run seed
Pop-Location

# 4. API
if (-not (Test-Port 4000)) {
    Write-Host "Starting API..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "pnpm run dev" -WorkingDirectory "$root\apps\api" -WindowStyle Minimized
    Wait-Port 4000 "API" | Out-Null
} else {
    Write-Host "API already running." -ForegroundColor Green
}

# 5. Metro
if (-not (Test-Port 8081)) {
    Write-Host "Starting Metro..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx expo start" -WorkingDirectory "$root\apps\mobile" -WindowStyle Minimized
    Wait-Port 8081 "Metro" | Out-Null
} else {
    Write-Host "Metro already running." -ForegroundColor Green
}

# 6. Port forwarding + launch
& $adb reverse tcp:4000 tcp:4000
& $adb reverse tcp:8081 tcp:8081
& $adb shell am force-stop host.exp.exponent
Start-Sleep -Seconds 1
& $adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"

Write-Host "Done - app launching on the emulator." -ForegroundColor Green
