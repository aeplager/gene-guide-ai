$ErrorActionPreference = "Stop"

function Copy-IfMissing {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path $Source)) {
        Write-Host "[ERROR] Missing source file: $Source" -ForegroundColor Red
        exit 1
    }

    if (Test-Path $Destination) {
        Write-Host "[INFO] Skipping existing $Destination" -ForegroundColor Yellow
        return
    }

    Copy-Item $Source $Destination
    Write-Host "[SUCCESS] Created $Destination from $Source" -ForegroundColor Green
}

Copy-IfMissing -Source "env.local.example" -Destination ".env.local"
Copy-IfMissing -Source "env.gcp.example" -Destination ".env.gcp"

Write-Host "[INFO] Next: update secrets in .env.local and .env.gcp" -ForegroundColor Cyan
