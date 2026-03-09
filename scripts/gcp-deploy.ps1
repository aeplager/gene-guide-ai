param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$Region = "us-central1",
    [string]$ServiceName = "gene-guide-api",
    [string]$Memory = "512Mi",
    [string]$Cpu = "1",
    [switch]$SkipFrontend = $false
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env.gcp")) {
    Write-Host "[ERROR] .env.gcp not found. Create it from env.gcp.example first." -ForegroundColor Red
    exit 1
}

$deployFrontend = -not $SkipFrontend

& ".\deploy-gcp.ps1" `
    -ProjectId $ProjectId `
    -Region $Region `
    -ServiceName $ServiceName `
    -Memory $Memory `
    -Cpu $Cpu `
    -DeployFrontend $deployFrontend `
    -EnvFile ".env.gcp"
