@echo off
REM =============================================================================
REM GCP Cloud Run Deployment Script (Batch - Windows)
REM =============================================================================
REM This script builds a Docker image locally, pushes to Google Container Registry,
REM and deploys to Cloud Run with environment variables from .env file.
REM
REM USAGE:
REM   deploy-gcp.bat <PROJECT_ID> [SERVICE_NAME] [REGION] [MEMORY] [CPU]
REM
REM EXAMPLES:
REM   deploy-gcp.bat chief-of-staff-480821
REM   deploy-gcp.bat chief-of-staff-480821 gene-guide-api us-central1 512Mi 1
REM
REM PREREQUISITES:
REM   1. gcloud CLI installed and authenticated (gcloud auth login)
REM   2. .env file exists in the project directory
REM   3. Dockerfile.backend exists in the project directory
REM
REM NOTE: For complex environment variables with special characters,
REM       use the PowerShell script instead: deploy-gcp.ps1
REM =============================================================================

setlocal EnableDelayedExpansion

REM =============================================================================
REM Configuration
REM =============================================================================

set "PROJECT_ID=%~1"
set "SERVICE_NAME=%~2"
set "REGION=%~3"
set "MEMORY=%~4"
set "CPU=%~5"
set "DOCKERFILE=Dockerfile.backend"
set "PORT=8081"
set "ENV_FILE=.env.gcp"
set "CLOUD_SQL_CONNECTION=chief-of-staff-480821:us-central1:sopheri"

REM Set defaults
if "%SERVICE_NAME%"=="" set "SERVICE_NAME=gene-guide-api"
if "%REGION%"=="" set "REGION=us-central1"
if "%MEMORY%"=="" set "MEMORY=512Mi"
if "%CPU%"=="" set "CPU=1"

REM =============================================================================
REM Validation
REM =============================================================================

echo.
echo ===============================================================
echo   GCP Cloud Run Deployment Script (Batch)
echo ===============================================================
echo.

if "%PROJECT_ID%"=="" (
    echo [ERROR] PROJECT_ID is required
    echo Usage: %~nx0 ^<PROJECT_ID^> [SERVICE_NAME] [REGION] [MEMORY] [CPU]
    exit /b 1
)

echo [INFO] Configuration:
echo   Project ID:    %PROJECT_ID%
echo   Service Name:  %SERVICE_NAME%
echo   Region:        %REGION%
echo   Memory:        %MEMORY%
echo   CPU:           %CPU%
echo   Dockerfile:    %DOCKERFILE%
echo   Port:          %PORT%
echo.

REM Check env file with backward-compatible fallback
if not exist "%ENV_FILE%" (
    if exist ".env" (
        echo [WARNING] .env.gcp not found; falling back to .env
        set "ENV_FILE=.env"
    ) else (
        echo [ERROR] %ENV_FILE% file not found! Please create it before deploying.
        exit /b 1
    )
)
echo [SUCCESS] %ENV_FILE% file found

REM Check if gcloud is installed
where gcloud >nul 2>&1
if errorlevel 1 (
    echo [ERROR] gcloud CLI is not installed
    echo Please install it from https://cloud.google.com/sdk/docs/install
    exit /b 1
)
echo [SUCCESS] gcloud CLI is installed

REM Check if Dockerfile exists
if not exist "%DOCKERFILE%" (
    echo [ERROR] %DOCKERFILE% not found!
    exit /b 1
)
echo [SUCCESS] %DOCKERFILE% found

REM =============================================================================
REM Environment Variables Extraction
REM =============================================================================

echo.
echo ===============================================================
echo   Step 2: Deploying to Cloud Run from Source
echo ===============================================================
echo.

echo [INFO] Deploying service: %SERVICE_NAME%
echo [INFO] Region: %REGION%
echo [INFO] Building and deploying from source (using Cloud Build)
echo [INFO] This may take 2-5 minutes...
echo.

REM Build environment variables string for command line
set "ENV_VARS="
for /f "usebackq tokens=* delims=" %%a in ("%ENV_FILE%") do (
    set "line=%%a"
    if not "!line!"=="" (
        set "first_char=!line:~0,1!"
        if not "!first_char!"=="#" (
            echo !line! | find "=" >nul
            if not errorlevel 1 (
                if "!ENV_VARS!"=="" (
                    set "ENV_VARS=!line!"
                ) else (
                    set "ENV_VARS=!ENV_VARS!,!line!"
                )
            )
        )
    )
)

REM Deploy with environment variables
gcloud run deploy %SERVICE_NAME% ^
    --source=. ^
    --platform=managed ^
    --region=%REGION% ^
    --memory=%MEMORY% ^
    --cpu=%CPU% ^
    --port=%PORT% ^
    --allow-unauthenticated ^
    --project=%PROJECT_ID% ^
    --max-instances=10 ^
    --min-instances=0 ^
    --timeout=300 ^
    --add-cloudsql-instances=%CLOUD_SQL_CONNECTION% ^
    --set-env-vars="%ENV_VARS%"

if errorlevel 1 (
    echo [ERROR] Deployment failed
    echo [INFO] If the error is related to environment variables,
    echo [INFO] try using the PowerShell script: deploy-gcp.ps1
    exit /b 1
)

echo [SUCCESS] Deployment completed successfully!

REM =============================================================================
REM Post-Deployment Information
REM =============================================================================

echo.
echo ===============================================================
echo   Deployment Summary
echo ===============================================================
echo.

REM Get the service URL
for /f "delims=" %%i in ('gcloud run services describe %SERVICE_NAME% --region=%REGION% --project=%PROJECT_ID% --format="value(status.url)" 2^>nul') do set "SERVICE_URL=%%i"

if "%SERVICE_URL%"=="" set "SERVICE_URL=Unable to retrieve URL"

echo [SUCCESS] Service deployed successfully!
echo.
echo   Service Name:  %SERVICE_NAME%
echo   Region:        %REGION%
echo   Project:       %PROJECT_ID%
echo   Source:        . (current directory)
echo   Memory:        %MEMORY%
echo   CPU:           %CPU%
echo.
echo   Service URL:   %SERVICE_URL%
echo.
echo [INFO] You can view logs with:
echo   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=%SERVICE_NAME%" --limit 50 --project=%PROJECT_ID%
echo.
echo [INFO] You can view the service in the console:
echo   https://console.cloud.google.com/run/detail/%REGION%/%SERVICE_NAME%/metrics?project=%PROJECT_ID%
echo.
echo [SUCCESS] Deployment complete!

endlocal
