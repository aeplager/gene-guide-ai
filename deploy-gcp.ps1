# =============================================================================
# GCP Cloud Run Deployment Script (PowerShell - Windows)
# =============================================================================
# This script builds a Docker image locally, pushes to Google Container Registry,
# and deploys to Cloud Run with environment variables from .env file.
#
# USAGE:
#   .\deploy-gcp.ps1 -ProjectId <PROJECT_ID> [-ServiceName <NAME>] [-Region <REGION>] [-Memory <SIZE>] [-Cpu <COUNT>]
#
# EXAMPLES:
#   .\deploy-gcp.ps1 -ProjectId "my-gcp-project"
#   .\deploy-gcp.ps1 -ProjectId "my-gcp-project" -ServiceName "legacy-forever-api" -Region "us-central1" -Memory "4Gi" -Cpu "4"
#
# PREREQUISITES:
#   1. gcloud CLI installed and authenticated (gcloud auth login)
#   2. .env file exists in the project directory
#   3. Dockerfile.backend exists in the project directory
# =============================================================================

param(
    [Parameter(Mandatory=$true, HelpMessage="GCP Project ID")]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "gene-guide-api",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-central1",
    
    [Parameter(Mandatory=$false)]
    [string]$Memory = "512Mi",
    
    [Parameter(Mandatory=$false)]
    [string]$Cpu = "1",
    
    [Parameter(Mandatory=$false)]
    [string]$Dockerfile = "Dockerfile.backend",
    
    [Parameter(Mandatory=$false)]
    [string]$Port = "8081",
    
    [Parameter(Mandatory=$false)]
    [string]$EnvFile = ".env",
    
    [Parameter(Mandatory=$false)]
    [bool]$DeployFrontend = $true,
    
    [Parameter(Mandatory=$false)]
    [string]$FrontendServiceName = "gene-guide-web",
    
    [Parameter(Mandatory=$false)]
    [string]$CloudSqlConnection = "chief-of-staff-480821:us-central1:sopheri"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# =============================================================================
# Helper Functions
# =============================================================================

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  $Message" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
}

# =============================================================================
# Validation
# =============================================================================

Write-Header "GCP Cloud Run Deployment Script"

Write-Info "Configuration:"
Write-Host "  Project ID:    $ProjectId"
Write-Host "  Service Name:  $ServiceName"
Write-Host "  Region:        $Region"
Write-Host "  Memory:        $Memory"
Write-Host "  CPU:           $Cpu"
Write-Host "  Dockerfile:    $Dockerfile"
Write-Host "  Port:          $Port"
Write-Host ""

# Check if .env file exists
if (-not (Test-Path $EnvFile)) {
    Write-Error "$EnvFile file not found! Please create it before deploying."
}
Write-Success "$EnvFile file found"

# Check if gcloud is installed
try {
    $null = Get-Command gcloud -ErrorAction Stop
    Write-Success "gcloud CLI is installed"
} catch {
    Write-Error "gcloud CLI is not installed. Please install it from https://cloud.google.com/sdk/docs/install"
}

# Check if Dockerfile exists
if (-not (Test-Path $Dockerfile)) {
    Write-Error "$Dockerfile not found!"
}
Write-Success "$Dockerfile found"

# =============================================================================
# Environment Variables Extraction
# =============================================================================

Write-Header "Step 1: Extracting Environment Variables"

Write-Info "Reading environment variables from $EnvFile..."

# Read .env file and extract environment variables
# Use a hashtable to handle duplicate keys (last occurrence wins)
$EnvMap = @{}
$LineNumber = 0

Get-Content $EnvFile | ForEach-Object {
    $LineNumber++
    $line = $_.Trim()
    
    # Skip empty lines
    if ([string]::IsNullOrWhiteSpace($line)) {
        return
    }
    
    # Skip comments (lines starting with #)
    if ($line -match '^\s*#') {
        return
    }
    
    # Skip lines without '='
    if ($line -notmatch '=') {
        return
    }
    
    # Extract key and value
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) {
        return
    }
    
    $key = $parts[0].Trim()
    $value = $parts[1]
    
    # Skip if key is empty
    if ([string]::IsNullOrWhiteSpace($key)) {
        return
    }
    
    # Remove inline comments (but preserve # in passwords/URLs)
    # Only remove comments that are preceded by whitespace
    if ($value -match '^(.+?)\s+#.*$') {
        $value = $matches[1].TrimEnd()
    }
    
    # Remove any carriage return or newline characters
    $value = $value.TrimEnd("`r", "`n")
    
    # Store in hashtable (overwrites duplicates automatically)
    $EnvMap[$key] = $value
}

# Convert hashtable to array of custom objects for deployment
$EnvVars = @()
foreach ($key in $EnvMap.Keys) {
    $value = $EnvMap[$key]
    $EnvVars += [PSCustomObject]@{
        Key = $key
        Value = $value
        Original = "$key=$value"
    }
}

Write-Success "Extracted $($EnvVars.Count) unique environment variables"

# Debug: Show first few variables (without sensitive values)
Write-Info "Sample variables extracted (keys only):"
for ($i = 0; $i -lt [Math]::Min(3, $EnvVars.Count); $i++) {
    Write-Host "  - $($EnvVars[$i].Key)"
}

# =============================================================================
# Cloud Run Deployment (Direct from Source)
# =============================================================================

Write-Header "Step 2: Deploying to Cloud Run from Source"

Write-Info "Deploying service: $ServiceName"
Write-Info "Region: $Region"
Write-Info "Building and deploying from source (using Cloud Build)"

# Build the base command
$DeployArgs = @(
    "run", "deploy", $ServiceName,
    "--source=.",
    "--clear-base-image",
    "--platform=managed",
    "--region=$Region",
    "--memory=$Memory",
    "--cpu=$Cpu",
    "--port=$Port",
    "--allow-unauthenticated",
    "--project=$ProjectId",
    "--max-instances=10",
    "--min-instances=0",
    "--timeout=300",
    "--add-cloudsql-instances=$CloudSqlConnection"
)

# Add environment variables
# Each variable is properly quoted to handle special characters
Write-Info "Adding $($EnvVars.Count) environment variables..."
foreach ($envVar in $EnvVars) {
    # Use the original "key=value" format
    # Properly escape for gcloud by using quotes
    $DeployArgs += "--set-env-vars"
    $DeployArgs += $envVar.Original
}

Write-Info "Executing deployment command..."
Write-Info "This may take 2-5 minutes..."

# Execute deployment using & operator with splatting
try {
    & gcloud @DeployArgs
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed with exit code $LASTEXITCODE"
    }
    
    Write-Success "Deployment completed successfully!"
} catch {
    Write-Error "Deployment failed: $_"
}

# =============================================================================
# Frontend Deployment (Optional)
# =============================================================================

if ($DeployFrontend) {
    Write-Header "Step 3: Deploying Frontend to Cloud Run"
    
    Write-Info "Deploying frontend service: $FrontendServiceName"
    Write-Info "Building and deploying frontend from source..."
    
    # Get backend URL for frontend configuration
    try {
        $BackendUrl = & gcloud run services describe $ServiceName `
            --region=$Region `
            --project=$ProjectId `
            --format="value(status.url)" 2>$null
        
        if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
            Write-Warning "Could not retrieve backend URL. Using default configuration."
            $BackendUrl = "https://$ServiceName-$Region.run.app"
        }
    } catch {
        Write-Warning "Could not retrieve backend URL. Using default configuration."
        $BackendUrl = "https://$ServiceName-$Region.run.app"
    }
    
    # Extract VAPI key from environment variables
    $VapiKey = ""
    foreach ($envVar in $EnvVars) {
        if ($envVar.Key -eq "VITE_VAPI_PUBLIC_KEY") {
            $VapiKey = $envVar.Value
            break
        }
    }
    
    if ([string]::IsNullOrWhiteSpace($VapiKey)) {
        Write-Warning "VITE_VAPI_PUBLIC_KEY not found in .env file"
    }
    
    # Build the frontend image first using Cloud Build
    $ImageName = "gcr.io/$ProjectId/${FrontendServiceName}:latest"
    
    Write-Info "Building frontend image with Cloud Build..."
    
    # Create temporary cloudbuild.yaml for frontend with build args
    $CloudBuildYaml = @"
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '$ImageName'
      - '-f'
      - 'Dockerfile.frontend'
      - '--build-arg'
      - 'VITE_TAVUS_BACKEND_URL=$BackendUrl'
      - '--build-arg'
      - 'VITE_VAPI_PUBLIC_KEY=$VapiKey'
      - '.'
images:
  - '$ImageName'
"@
    
    $TempConfigFile = Join-Path $env:TEMP "cloudbuild-frontend.yaml"
    $CloudBuildYaml | Out-File -FilePath $TempConfigFile -Encoding UTF8
    
    try {
        & gcloud builds submit --config=$TempConfigFile --project=$ProjectId --region=$Region .
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend image build failed with exit code $LASTEXITCODE"
        }
        
        Write-Success "Frontend image built successfully!"
    } catch {
        Write-Error "Frontend image build failed: $_"
    } finally {
        # Cleanup temp file
        if (Test-Path $TempConfigFile) {
            Remove-Item $TempConfigFile -Force
        }
    }
    
    # Deploy the frontend image
    Write-Info "Deploying frontend to Cloud Run..."
    
    $FrontendDeployArgs = @(
        "run", "deploy", $FrontendServiceName,
        "--image=$ImageName",
        "--platform=managed",
        "--region=$Region",
        "--memory=$Memory",
        "--cpu=$Cpu",
        "--port=80",
        "--allow-unauthenticated",
        "--project=$ProjectId",
        "--max-instances=10",
        "--min-instances=0",
        "--timeout=300"
    )
    
    Write-Info "Executing frontend deployment..."
    
    try {
        & gcloud @FrontendDeployArgs
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Frontend deployment failed with exit code $LASTEXITCODE"
        }
        
        Write-Success "Frontend deployment completed successfully!"
    } catch {
        Write-Error "Frontend deployment failed: $_"
    }
}

# =============================================================================
# Post-Deployment Information
# =============================================================================

Write-Header "Deployment Summary"

# Get the backend service URL
try {
    $ServiceUrl = & gcloud run services describe $ServiceName `
        --region=$Region `
        --project=$ProjectId `
        --format="value(status.url)" 2>$null
    
    if ([string]::IsNullOrWhiteSpace($ServiceUrl)) {
        $ServiceUrl = "Unable to retrieve URL"
    }
} catch {
    $ServiceUrl = "Unable to retrieve URL"
}

Write-Success "Backend service deployed successfully!"
Write-Host ""
Write-Host "  Service Name:  $ServiceName"
Write-Host "  Region:        $Region"
Write-Host "  Project:       $ProjectId"
Write-Host "  Source:        . (current directory)"
Write-Host "  Memory:        $Memory"
Write-Host "  CPU:           $Cpu"
Write-Host "  Cloud SQL:     $CloudSqlConnection"
Write-Host ""
Write-Host "  Service URL:   $ServiceUrl"
Write-Host ""

if ($DeployFrontend) {
    # Get the frontend service URL
    try {
        $FrontendUrl = & gcloud run services describe $FrontendServiceName `
            --region=$Region `
            --project=$ProjectId `
            --format="value(status.url)" 2>$null
        
        if ([string]::IsNullOrWhiteSpace($FrontendUrl)) {
            $FrontendUrl = "Unable to retrieve URL"
        }
    } catch {
        $FrontendUrl = "Unable to retrieve URL"
    }
    
    Write-Success "Frontend service deployed successfully!"
    Write-Host ""
    Write-Host "  Service Name:  $FrontendServiceName"
    Write-Host "  Frontend URL:  $FrontendUrl"
    Write-Host ""
}

Write-Info "You can view logs with:"
Write-Host "  gcloud logging read `"resource.type=cloud_run_revision AND resource.labels.service_name=$ServiceName`" --limit 50 --project=$ProjectId"
Write-Host ""

Write-Info "You can view the service in the console:"
Write-Host "  https://console.cloud.google.com/run/detail/$Region/$ServiceName/metrics?project=$ProjectId"
Write-Host ""

Write-Success "Deployment complete! 🚀"
