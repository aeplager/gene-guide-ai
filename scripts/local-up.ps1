param(
    [switch]$Detach = $true,
    [switch]$Build = $true
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env.local")) {
    Write-Host "[ERROR] .env.local not found. Create it from env.local.example first." -ForegroundColor Red
    exit 1
}

$cmd = @("compose", "--env-file", ".env.local", "up")
if ($Detach) { $cmd += "-d" }
if ($Build) { $cmd += "--build" }

Write-Host "[INFO] Running: docker $($cmd -join ' ')" -ForegroundColor Cyan
& docker @cmd
