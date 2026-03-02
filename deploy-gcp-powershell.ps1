###############################################################################
# GCP Cloud Run Deployment Script for Gene Guide AI (PowerShell)
# Deploys both backend API and frontend to Google Cloud Run
# Usage: .\deploy-gcp-powershell.ps1 -ProjectId <GCP_PROJECT_ID> [-Region us-central1]
# Example: .\deploy-gcp-powershell.ps1 -ProjectId my-project-123
###############################################################################

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,

    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1"
)

# Error handling
$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info {
    Write-Host "[INFO] " -ForegroundColor Cyan -NoNewline
    Write-Host $args[0]
}

function Write-Success {
    Write-Host "[SUCCESS] " -ForegroundColor Green -NoNewline
    Write-Host $args[0]
}

function Write-Error-Custom {
    Write-Host "[ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $args[0]
    exit 1
}

function Write-Warning-Custom {
    Write-Host "[WARNING] " -ForegroundColor Yellow -NoNewline
    Write-Host $args[0]
}

# Configuration
$BackendServiceName = "gene-guide-api"
$FrontendServiceName = "gene-guide-web"
$RegistryRegion = $Region
$RepoName = "gene-guide-repo"

Write-Info "Starting deployment for Gene Guide AI to GCP Cloud Run"
Write-Info "Project ID: $ProjectId"
Write-Info "Region: $Region"

# Check prerequisites
Write-Info "Checking prerequisites..."
try {
    $null = gcloud --version 2>$null
} catch {
    Write-Error-Custom "gcloud CLI is not installed. Please install Google Cloud SDK."
}

try {
    $null = docker --version 2>$null
} catch {
    Write-Error-Custom "Docker is not installed. Please install Docker Desktop."
}

# Authenticate with GCP
Write-Info "Authenticating with GCP..."
gcloud auth application-default print-access-token | Out-Null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Info "Opening GCP authentication..."
    gcloud auth login
}

# Set project
Write-Info "Setting GCP project to $ProjectId..."
gcloud config set project $ProjectId

# Get project number
Write-Info "Retrieving project number..."
$ProjectNumber = gcloud projects describe $ProjectId --format='value(projectNumber)'
Write-Info "Project number: $ProjectNumber"

# Set up Artifact Registry
$Registry = "$RegistryRegion-docker.pkg.dev"
$ImageGcpUrl = "$Registry/$ProjectId/$RepoName"

Write-Info "Setting up Artifact Registry..."
$repoExists = gcloud artifacts repositories describe $RepoName `
    --location=$RegistryRegion `
    --project=$ProjectId 2>$null

if (-not $repoExists) {
    Write-Info "Creating artifact repository $RepoName..."
    gcloud artifacts repositories create $RepoName `
        --location=$RegistryRegion `
        --repository-format="docker" `
        --project=$ProjectId
} else {
    Write-Info "Repository $RepoName already exists"
}

# Configure Docker authentication
Write-Info "Configuring Docker authentication..."
gcloud auth configure-docker "$Registry" --quiet

# Load environment variables
if (-not (Test-Path ".env")) {
    Write-Error-Custom ".env file not found. Please create it from env.example"
}

Write-Info "Loading environment configuration from .env..."
$envContent = Get-Content ".env" -Raw
$envLines = $envContent -split "`n" | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith("#") }

$envDict = @{}
foreach ($line in $envLines) {
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
        $envDict[$parts[0].Trim()] = $parts[1].Trim()
    }
}

# Build and push backend
Write-Info "Building backend image..."
$BackendImage = "$ImageGcpUrl/$BackendServiceName"
docker build -f Dockerfile.backend -t "$($BackendImage):latest" `
    --build-arg PORT=8081 .

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Backend build failed"
}

Write-Info "Pushing backend image to Artifact Registry..."
docker push "$($BackendImage):latest"

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Backend push failed"
}

# Build and push frontend
Write-Info "Building frontend image..."
$FrontendImage = "$ImageGcpUrl/$FrontendServiceName"
$FrontendBackendUrl = "https://$BackendServiceName-$ProjectNumber.$Region.run.app"

docker build -f Dockerfile.frontend -t "$($FrontendImage):latest" `
    --build-arg VITE_TAVUS_BACKEND_URL="$FrontendBackendUrl" `
    --build-arg VITE_VAPI_PUBLIC_KEY="$($envDict['VITE_VAPI_PUBLIC_KEY'])" .

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Frontend build failed"
}

Write-Info "Pushing frontend image to Artifact Registry..."
docker push "$($FrontendImage):latest"

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Frontend push failed"
}

# Prepare environment variables
Write-Info "Building environment variables..."
$envVars = @(
    "TAVUS_API_KEY=$($envDict['TAVUS_API_KEY'])",
    "TAVUS_REPLICA_ID=$($envDict['TAVUS_REPLICA_ID'])",
    "TAVUS_PERSONA_ID=$($envDict['TAVUS_PERSONA_ID'])",
    "TAVUS_CALLBACK_URL=$($envDict['TAVUS_CALLBACK_URL'])",
    "DB_CONNECTION_STRING=$($envDict['DB_CONNECTION_STRING'])",
    "COMPANY_ID=$($envDict['COMPANY_ID'])",
    "CUSTOM_LLM_API_KEY=$($envDict['CUSTOM_LLM_API_KEY'])",
    "CUSTOM_LLM_PERSONA_ID=$($envDict['CUSTOM_LLM_PERSONA_ID'])",
    "JWT_SECRET=$($envDict['JWT_SECRET'])",
    "JWT_EXP_HOURS=$($envDict['JWT_EXP_HOURS'])",
    "TAVUS_CUSTOM_LLM_ENABLE=$($envDict['TAVUS_CUSTOM_LLM_ENABLE'])",
    "TAVUS_ENABLE_RECORDING=$($envDict['TAVUS_ENABLE_RECORDING'])"
)

# Deploy backend
Write-Info "Deploying backend to Cloud Run..."
$envVarsArg = $envVars -join ","
gcloud run deploy $BackendServiceName `
    --image "$($BackendImage):latest" `
    --platform managed `
    --region $Region `
    --memory 512Mi `
    --cpu 1 `
    --timeout 300 `
    --max-instances 100 `
    --set-env-vars $envVarsArg `
    --allow-unauthenticated `
    --project $ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Backend deployment failed"
}

Write-Success "Backend deployed!"

# Deploy frontend
Write-Info "Deploying frontend to Cloud Run..."
gcloud run deploy $FrontendServiceName `
    --image "$($FrontendImage):latest" `
    --platform managed `
    --region $Region `
    --memory 256Mi `
    --cpu 1 `
    --timeout 60 `
    --max-instances 100 `
    --allow-unauthenticated `
    --project $ProjectId

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Frontend deployment failed"
}

Write-Success "Frontend deployed!"

# Get URLs
Write-Info "Retrieving service URLs..."
$BackendUrl = gcloud run services describe $BackendServiceName `
    --region $Region `
    --project $ProjectId `
    --format='value(status.url)'

$FrontendUrl = gcloud run services describe $FrontendServiceName `
    --region $Region `
    --project $ProjectId `
    --format='value(status.url)'

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Success "Deployment Complete!"
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API" -ForegroundColor Green
Write-Host "  URL: $BackendUrl"
Write-Host "  Health: $BackendUrl/health"
Write-Host ""
Write-Host "Frontend" -ForegroundColor Green
Write-Host "  URL: $FrontendUrl"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Update frontend .env: VITE_TAVUS_BACKEND_URL=$BackendUrl"
Write-Host "  2. Verify deployment: gcloud run services list --region=$Region"
Write-Host "  3. View logs: gcloud run logs read $BackendServiceName --region=$Region --limit=50"
Write-Host ""
