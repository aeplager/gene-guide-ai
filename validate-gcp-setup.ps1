# =============================================================================
# GCP Cloud Run - Setup Validation Script (PowerShell)
# =============================================================================
# This script validates that your environment is properly configured for
# deploying to Google Cloud Run.
#
# USAGE:
#   .\validate-gcp-setup.ps1 [-ProjectId <PROJECT_ID>] [-Detailed]
#
# EXAMPLES:
#   .\validate-gcp-setup.ps1
#   .\validate-gcp-setup.ps1 -ProjectId "my-gcp-project"
#   .\validate-gcp-setup.ps1 -ProjectId "my-gcp-project" -Detailed
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Detailed = $false
)

$ErrorActionPreference = "Continue"

# =============================================================================
# Helper Functions
# =============================================================================

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[✓] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "[✗] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[!] $Message" -ForegroundColor Yellow
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

# =============================================================================
# Validation Checks
# =============================================================================

Write-Header "GCP Cloud Run Setup Validation"

$allChecks = @()
$passedChecks = 0
$failedChecks = 0

# Check 1: gcloud CLI Installation
Write-Info "Checking gcloud CLI installation..."
try {
    $gcloudVersion = (gcloud version --format="value(core)" 2>$null)
    if ($LASTEXITCODE -eq 0) {
        Write-Success "gcloud CLI is installed: version $gcloudVersion"
        $passedChecks++
        $allChecks += @{Status="PASS"; Check="gcloud CLI"; Details="Version $gcloudVersion"}
    } else {
        throw "gcloud not found"
    }
} catch {
    Write-Fail "gcloud CLI is not installed"
    Write-Info "  → Install gcloud: https://cloud.google.com/sdk/docs/install"
    $failedChecks++
    $allChecks += @{Status="FAIL"; Check="gcloud CLI"; Details="Not installed"}
}

# Check 2: gcloud Authentication
Write-Info "Checking gcloud authentication..."
try {
    $activeAccount = (gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $activeAccount) {
        Write-Success "Authenticated as: $activeAccount"
        $passedChecks++
        $allChecks += @{Status="PASS"; Check="gcloud Auth"; Details=$activeAccount}
    } else {
        throw "Not authenticated"
    }
} catch {
    Write-Fail "Not authenticated with gcloud"
    Write-Info "  → Run: gcloud auth login"
    $failedChecks++
    $allChecks += @{Status="FAIL"; Check="gcloud Auth"; Details="Not authenticated"}
}

# Check 3: Project ID Configuration
if ($ProjectId) {
    Write-Info "Checking GCP project access..."
    try {
        $projectInfo = (gcloud projects describe $ProjectId --format="value(projectId)" 2>$null)
        if ($LASTEXITCODE -eq 0 -and $projectInfo) {
            Write-Success "Access to project: $ProjectId"
            $passedChecks++
            $allChecks += @{Status="PASS"; Check="Project Access"; Details=$ProjectId}
        } else {
            throw "No access"
        }
    } catch {
        Write-Fail "Cannot access project: $ProjectId"
        Write-Info "  → Verify project ID is correct"
        Write-Info "  → Ensure you have proper permissions"
        $failedChecks++
        $allChecks += @{Status="FAIL"; Check="Project Access"; Details="No access to $ProjectId"}
    }
    
    # Check 4: Cloud Run API
    Write-Info "Checking Cloud Run API status..."
    try {
        $apiEnabled = (gcloud services list --enabled --project=$ProjectId --filter="name:run.googleapis.com" --format="value(name)" 2>$null)
        if ($apiEnabled) {
            Write-Success "Cloud Run API is enabled"
            $passedChecks++
            $allChecks += @{Status="PASS"; Check="Cloud Run API"; Details="Enabled"}
        } else {
            Write-Warning "Cloud Run API is not enabled"
            Write-Info "  → Enable it: gcloud services enable run.googleapis.com --project=$ProjectId"
            $allChecks += @{Status="WARN"; Check="Cloud Run API"; Details="Not enabled"}
        }
    } catch {
        Write-Warning "Unable to check Cloud Run API status"
        $allChecks += @{Status="WARN"; Check="Cloud Run API"; Details="Unable to verify"}
    }
    
    # Check 5: Cloud Build API
    Write-Info "Checking Cloud Build API (required for --source deployments)..."
    try {
        $apiEnabled = (gcloud services list --enabled --project=$ProjectId --filter="name:cloudbuild.googleapis.com" --format="value(name)" 2>$null)
        if ($apiEnabled) {
            Write-Success "Cloud Build API is enabled"
            $passedChecks++
            $allChecks += @{Status="PASS"; Check="Cloud Build API"; Details="Enabled"}
        } else {
            Write-Warning "Cloud Build API is not enabled"
            Write-Info "  → Enable it: gcloud services enable cloudbuild.googleapis.com --project=$ProjectId"
            $allChecks += @{Status="WARN"; Check="Cloud Build API"; Details="Not enabled"}
        }
    } catch {
        Write-Warning "Unable to check Cloud Build API status"
        $allChecks += @{Status="WARN"; Check="Cloud Build API"; Details="Unable to verify"}
    }
}

# Check 6: .env file
Write-Info "Checking .env file..."
if (Test-Path ".env") {
    $envLines = (Get-Content ".env" | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' }).Count
    Write-Success ".env file found with $envLines environment variables"
    $passedChecks++
    $allChecks += @{Status="PASS"; Check=".env File"; Details="$envLines variables"}
    
    # Check for special characters in .env
    Write-Info "Checking for special characters in environment variables..."
    $specialChars = Get-Content ".env" | Where-Object { 
        $_ -match '=' -and 
        $_ -notmatch '^\s*#' -and 
        ($_ -match '%' -or $_ -match '#[^=]+$')
    }
    if ($specialChars) {
        Write-Warning "Found $($specialChars.Count) variables with special characters (%, #)"
        Write-Info "  → These will be properly handled by the deployment scripts"
        if ($Detailed) {
            $specialChars | ForEach-Object {
                $key = ($_ -split '=')[0]
                Write-Host "    - $key" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Fail ".env file not found"
    Write-Info "  → Create a .env file with your environment variables"
    Write-Info "  → Use env.example as a template"
    $failedChecks++
    $allChecks += @{Status="FAIL"; Check=".env File"; Details="Not found"}
}

# Check 7: Dockerfile
Write-Info "Checking Dockerfile.backend..."
if (Test-Path "Dockerfile.backend") {
    Write-Success "Dockerfile.backend found"
    $passedChecks++
    $allChecks += @{Status="PASS"; Check="Dockerfile"; Details="Found"}
} else {
    Write-Fail "Dockerfile.backend not found"
    $failedChecks++
    $allChecks += @{Status="FAIL"; Check="Dockerfile"; Details="Not found"}
}

# Check 8: Python Version (for gcloud - optional)
if ($Detailed) {
    Write-Info "Checking Python installation (for gcloud)..."
    try {
        $pythonVersion = (python --version 2>&1)
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Python is installed: $pythonVersion"
            if ($pythonVersion -match "Python 3\.13") {
                Write-Warning "Python 3.13 detected - gcloud may have compatibility issues"
                Write-Info "  → Consider using Python 3.11 or 3.12 if you encounter problems"
            }
            $allChecks += @{Status="INFO"; Check="Python Version"; Details=$pythonVersion}
        }
    } catch {
        Write-Info "Python not found (optional for gcloud)"
    }
}

# =============================================================================
# Summary
# =============================================================================

Write-Header "Validation Summary"

Write-Host "Results:"
Write-Host "  Passed: $passedChecks" -ForegroundColor Green
if ($failedChecks -gt 0) {
    Write-Host "  Failed: $failedChecks" -ForegroundColor Red
}
Write-Host ""

if ($Detailed) {
    Write-Host "Detailed Results:"
    Write-Host ""
    $allChecks | ForEach-Object {
        $status = $_["Status"]
        $check = $_["Check"]
        $details = $_["Details"]
        
        $color = switch ($status) {
            "PASS" { "Green" }
            "FAIL" { "Red" }
            "WARN" { "Yellow" }
            default { "Gray" }
        }
        
        Write-Host "  [$status] " -NoNewline -ForegroundColor $color
        Write-Host "$check" -NoNewline
        Write-Host " - $details" -ForegroundColor Gray
    }
    Write-Host ""
}

# Final verdict
if ($failedChecks -eq 0) {
    Write-Success "Your environment is ready for deployment! ✓"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "  1. Ensure .env file has all required variables"
    Write-Host "  2. Run deployment script:"
    Write-Host "     Windows: .\deploy-gcp.ps1 -ProjectId YOUR_PROJECT_ID"
    Write-Host "     Linux/Mac: ./deploy-gcp.sh YOUR_PROJECT_ID"
    Write-Host ""
    exit 0
} else {
    Write-Fail "Please fix the issues above before deploying"
    Write-Host ""
    exit 1
}
