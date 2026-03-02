# GCP Cloud Run Deployment Guide

This guide provides comprehensive instructions for deploying your Docker-based application to Google Cloud Platform (Cloud Run) with proper environment variable handling.

## � Current Deployment Configuration

**Project:** `chief-of-staff-480821`  
**Region:** `us-central1`

### Backend Service
- **Service Name:** `gene-guide-api`
- **Memory:** 512Mi (512MB)
- **CPU:** 1 vCPU
- **Port:** 8081
- **Dockerfile:** `Dockerfile.backend`
- **Cloud SQL:** `chief-of-staff-480821:us-central1:sopheri`

### Frontend Service
- **Service Name:** `gene-guide-web`
- **Memory:** 512Mi (512MB)
- **CPU:** 1 vCPU
- **Port:** 80
- **Dockerfile:** `Dockerfile.frontend`

### Database Connection
```
DB_CONNECTION_STRING=postgresql+asyncpg://postgres:Judah_Strong124-@/agentic_core?host=/cloudsql/chief-of-staff-480821:us-central1:sopheri
```

## ⚡ Quick Start

### Deploy Backend Only
```powershell
.\deploy-gcp.ps1 -ProjectId "chief-of-staff-480821"
```

### Deploy Both Backend and Frontend (Recommended)
```powershell
.\deploy-gcp.ps1 -ProjectId "chief-of-staff-480821" -DeployFrontend
```

### Deploy with Custom Resources
```powershell
# If you need different memory/CPU settings:
.\deploy-gcp.ps1 -ProjectId "chief-of-staff-480821" -Memory "1Gi" -Cpu "2" -DeployFrontend
```

**Note:** The default configuration (512Mi/1 CPU) is optimized for cost-efficiency while maintaining good performance. Use the custom resources command only if you need more capacity.

## 📋 Table of Contents

- [Current Deployment Configuration](#-current-deployment-configuration)
- [Quick Start](#-quick-start)
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [One-Time Setup](#one-time-setup)
- [Deployment Scripts](#deployment-scripts)
- [Environment Variable Handling](#environment-variable-handling)
- [Deployment Process](#deployment-process)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🎯 Overview

This deployment solution provides:

- ✅ Direct deployment from source code to Cloud Run (no container registry needed)
- ✅ Automatic image building via Cloud Build
- ✅ Backend (API) and Frontend (Web) deployments
- ✅ Cloud SQL database integration with Unix socket connection
- ✅ Proper handling of special characters in environment variables (`#`, `%`, `=`, etc.)
- ✅ Multi-platform support (Windows, Linux, macOS)
- ✅ No external CI/CD pipelines required
- ✅ Simple command-line deployment
- ✅ Validation tools to ensure proper setup
- ✅ Resource-efficient configuration (512MB/1 vCPU)

## 📦 Prerequisites

### Required Software

1. **Google Cloud SDK (gcloud CLI)**
   - [Installation Guide](https://cloud.google.com/sdk/docs/install)
   - Verify: `gcloud --version`

2. **GCP Account & Project**
   - Active GCP account with billing enabled
   - A GCP project ID (e.g., `my-project-123`)
   - Necessary permissions (Project Editor or Cloud Run Admin + Cloud Build Editor)

### File Requirements

- `Dockerfile.backend` - Your Docker configuration
- `.env` - Environment variables (see [Environment Variables](#environment-variable-handling))

## 🔧 One-Time Setup

### Step 1: Install Required Tools

**Windows (PowerShell):**
```powershell
# Check installation
gcloud --version
```

**Linux/macOS (Bash):**
```bash
# Check installation
gcloud --version
```

### Step 2: Authenticate with GCP

```bash
# Login to your GCP account
gcloud auth login

# Set your default project (optional)
gcloud config set project chief-of-staff-480821
```

### Step 3I: Enable Required APIs

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com --project=YOUR_PROJECT_ID

# Enable Cloud Build API (required for source deployments)
gcloud services enable cloudbuild.googleapis.com --project=YOUR_PROJECT_ID
```

### Step 4: Validate Setup

**Windows (PowerShell):**
```powershell
.\validate-gcp-setup.ps1 -ProjectId YOUR_PROJECT_ID -Detailed
```

**Linux/macOS (Bash):**
```bash
# Manual validation
gcloud auth list
gcloud projects describe YOUR_PROJECT_ID
gcloud services list --enabled --project=YOUR_PROJECT_ID | grep -E '(run|cloudbuild)'
```

## 🚀 Deployment Scripts

Three deployment scripts are provided for different platforms:

| Script | Platform | Best For |
|--------|----------|----------|
| `deploy-gcp.sh` | Linux/macOS/Windows | Bash environments (Git Bash, WSL, or native) |
| `deploy-gcp.ps1` | Windows | PowerShell users (recommended for Windows) |
| `deploy-gcp.bat` | Windows | Command Prompt users (limited special char support) |

### Script Features

All scripts provide:

- ✅ Validation checks before deployment
- ✅ Direct deployment from source using Cloud Build
- ✅ Automatic Docker image building in the cloud
- ✅ Deployment to Cloud Run with full configuration
- ✅ Proper environment variable escaping
- ✅ Detailed logging with color-coded output
- ✅ Error handling with helpful messages

## 🔐 Environment Variable Handling

### Critical: Special Characters

The scripts properly handle special characters in environment variables:

| Character | Example Use Case | Handling |
|-----------|------------------|----------|
| `#` | Comments, passwords | Properly quoted and escaped |
| `%` | URL encoding (e.g., `%23` for #) | Preserved as-is |
| `=` | In values | Split only on first `=` |
| Spaces | Paths, values | Fully quoted |
| `$` | Dollar signs | Escaped in bash |

### .env File Format

**Good Examples:**

```env
# Comments are automatically filtered out
DATABASE_URL=postgresql://user:pass%2312@host:5432/db
API_KEY=sk-proj-abc123-xyz
PASSWORD=myP@ss#123
TAVUS_CALLBACK_URL=https://example.com/callback?token=abc#section
```

**What Gets Filtered:**

```env
# This is a comment - IGNORED
  # Indented comment - IGNORED

KEY=value # This comment is preserved or trimmed safely
```

### Testing Special Characters

Create a test `.env` file to verify:

```env
TEST_HASH=value#after
TEST_PERCENT=value%23percent
TEST_EQUALS=key=value
TEST_SPACE=value with spaces
TEST_COMBO=complex%23value#with#everything
```

All values will be correctly passed to Cloud Run.

## 📝 Deployment Process

### Using PowerShell (Windows - Recommended)

**Basic Backend Deployment:**
```powershell
.\deploy-gcp.ps1 -ProjectId "chief-of-staff-480821"
```

**Deploy Both Backend and Frontend:**
```powershell
.\deploy-gcp.ps1 -ProjectId "chief-of-staff-480821" -DeployFrontend
```

**Custom Configuration:**
```powershell
.\deploy-gcp.ps1 `
    -ProjectId "chief-of-staff-480821" `
    -ServiceName "gene-guide-api" `
    -Region "us-central1" `
    -Memory "512Mi" `
    -Cpu "1" `
    -DeployFrontend
```

**All Parameters:**
```powershell
.\deploy-gcp.ps1 `
    -ProjectId "chief-of-staff-480821" `           # Required
    -ServiceName "gene-guide-api" `                # Optional (default: gene-guide-api)
    -Region "us-central1" `                        # Optional (default: us-central1)
    -Memory "512Mi" `                              # Optional (default: 512Mi)
    -Cpu "1" `                                     # Optional (default: 1)
    -Dockerfile "Dockerfile.backend" `             # Optional
    -Port "8081" `                                  # Optional
    -EnvFile ".env" `                               # Optional
    -DeployFrontend `                               # Optional switch to deploy frontend
    -FrontendServiceName "gene-guide-web" `        # Optional (default: gene-guide-web)
    -CloudSqlConnection "chief-of-staff-480821:us-central1:sopheri" # Optional
```

### Using Bash (Linux/macOS/Windows)

**Works on Windows via:**
- Git Bash (comes with [Git for Windows](https://git-scm.com/download/win))
- WSL (Windows Subsystem for Linux)
- Any bash shell

**Basic Backend Deployment:**
```bash
chmod +x deploy-gcp.sh  # First time only
./deploy-gcp.sh chief-of-staff-480821
```

**Deploy Both Backend and Frontend:**
```bash
./deploy-gcp.sh chief-of-staff-480821 gene-guide-api us-central1 512Mi 1 true
```

**Windows-specific notes:**
- Use forward slashes: `./deploy-gcp.sh`
- Git Bash automatically handles Windows paths
- If using WSL, ensure gcloud is installed in WSL environment

**Custom Configuration:**
```bash
./deploy-gcp.sh chief-of-staff-480821 gene-guide-api us-central1 512Mi 1
```

**Parameters:**
```bash
./deploy-gcp.sh <PROJECT_ID> [SERVICE_NAME] [REGION] [MEMORY] [CPU] [DEPLOY_FRONTEND]
```

**Defaults:**
- SERVICE_NAME: `gene-guide-api`
- REGION: `us-central1`
- MEMORY: `512Mi`
- CPU: `1`
- DEPLOY_FRONTEND: `false`
- FRONTEND_SERVICE_NAME: `gene-guide-web`
- CLOUD_SQL_CONNECTION: `chief-of-staff-480821:us-central1:sopheri`

### Using Batch (Windows CMD)

**Note:** Limited support for special characters. Use PowerShell if you have complex environment variables.

```batch
deploy-gcp.bat chief-of-staff-480821
```

```batch
deploy-gcp.bat chief-of-staff-480821 gene-guide-api us-central1 512Mi 1
```

## 🔍 Deployment Steps Explained

### Backend Deployment

Each script performs these steps for the backend:

1. **Validation** (30 seconds)
   - Verify `.env` file exists
   - Verify gcloud CLI is installed
   - Validate Dockerfile exists

2. **Environment Variable Extraction** (5 seconds)
   - Parse `.env` file
   - Filter comments
   - Handle special characters
   - Build proper gcloud arguments

3. **Backend Cloud Run Deployment with Cloud Build** (3-8 minutes)
   - Upload source code to Cloud Build
   - Build Docker image in the cloud (from Dockerfile.backend)
   - Store image in Container Registry automatically
   - Deploy to Cloud Run with configuration:
     - Memory: 512Mi (default)
     - CPU: 1 (default)
     - Port: 8081
     - Cloud SQL connection
     - Allow unauthenticated access
     - Max instances: 10
     - Timeout: 300 seconds
   - Set all environment variables
   - Create or update service

### Frontend Deployment (Optional with -DeployFrontend flag)

4. **Frontend Image Build** (2-5 minutes)
   - Build frontend Docker image using Cloud Build
   - Use Dockerfile.frontend
   - Pass build arguments (VITE_TAVUS_BACKEND_URL, VITE_VAPI_PUBLIC_KEY)
   - Tag and store image in Container Registry

5. **Frontend Cloud Run Deployment** (1-3 minutes)
   - Deploy pre-built frontend image to Cloud Run
   - Configuration:
     - Memory: 512Mi (default)
     - CPU: 1 (default)
     - Port: 80
     - Allow unauthenticated access
     - Max instances: 10
   - Create or update frontend service

6. **Verification** (10 seconds)
   - Retrieve service URLs (backend and frontend if deployed)
   - Display summary
   - Show console links

**Total Time:** 
- Backend only: ~4-10 minutes
- Backend + Frontend: ~7-15 minutes  
(slower on first deployment, faster on updates)

## 🔧 Configuration Options

### Memory & CPU

Cloud Run supports these configurations:

| Memory | Min CPU | Max CPU | Use Case |
|--------|---------|---------|----------|
| 512Mi | 1 | 2 | Light workloads |
| 1Gi | 1 | 2 | Small apps |
| 2Gi | 1 | 4 | Medium apps |
| 4Gi | 2 | 4 | Large apps (default) |
| 8Gi | 2 | 4 | Heavy workloads |

**Adjust based on your needs:**

```powershell
# Light deployment
.\deploy-gcp.ps1 -ProjectId "my-project" -Memory "1Gi" -Cpu "1"

# Heavy deployment
.\deploy-gcp.ps1 -ProjectId "my-project" -Memory "8Gi" -Cpu "4"
```

### Regions

Available regions (examples):

- `us-central1` (Iowa) - Default
- `us-east1` (South Carolina)
- `us-west1` (Oregon)
- `europe-west1` (Belgium)
- `asia-east1` (Taiwan)

[Full list of regions](https://cloud.google.com/run/docs/locations)

### Scaling

Default configuration:
- **Min instances:** 0 (scales to zero when idle)
- **Max instances:** 10 (prevents runaway costs)

To modify, edit the deployment script or add these flags:

```bash
--min-instances=1  # Keep at least 1 instance running (no cold starts)
--max-instances=50 # Allow up to 50 instances
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Cloud Build API Not Enabled

**Error:**
```
ERROR: (gcloud.run.deploy) Cloud Build API is not enabled
```

**Solution:**
```bash
gcloud services enable cloudbuild.googleapis.com --project=YOUR_PROJECT_ID
```

#### 2. Environment Variable Issues

**Error:**
```
ERROR: (gcloud.run.deploy) Invalid value for [--set-env-vars]
```

**Solutions:**
- Use PowerShell script instead of Batch (better special char handling)
- Verify `.env` file has no syntax errors
- Check for unbalanced quotes in `.env`

**Debug:**
```powershell
# View parsed environment variables
Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' }
```

#### 3. Cloud Run API Not Enabled

**Error:**
```
ERROR: (gcloud.run.deploy) Cloud Run API not enabled
```

**Solution:**
```bash
gcloud services enable run.googleapis.com --project=YOUR_PROJECT_ID
```

#### 4. Insufficient Permissions

**Error:**
```
ERROR: (gcloud.run.deploy) User does not have permission
```

**Solution:**
Grant necessary roles:
```bash
# Via gcloud
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="user:your-email@example.com" \
    --role="roles/run.admin"

# Or in Console: IAM & Admin → Add roles
# Required roles:
# - Cloud Run Admin
# - Cloud Build Editor
# - Service Account User
```

#### 5. Port Issues

**Error:**
```
Service fails health checks / Container crashed
```

**Solution:**
Ensure your app:
- Listens on the port specified in `PORT` environment variable OR the hardcoded port (8081)
- Binds to `0.0.0.0` (not `localhost` or `127.0.0.1`)

In your app:
```python
# Python example
app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8081)))
```

### Viewing Logs

**Real-time logs:**
```bash
gcloud logging tail "resource.type=cloud_run_revision" --project=YOUR_PROJECT_ID
```

**Recent logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=SERVICE_NAME" \
    --limit 50 \
    --project=YOUR_PROJECT_ID \
    --format=json
```

**In Console:**
1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click your service
3. Click "LOGS" tab

### Testing Deployment

After deployment, test your service:

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe SERVICE_NAME \
    --region=REGION \
    --project=PROJECT_ID \
    --format="value(status.url)")

# Test endpoint
curl $SERVICE_URL
curl $SERVICE_URL/health  # If you have a health endpoint

# Test with headers
curl -H "Content-Type: application/json" -X POST $SERVICE_URL/api/endpoint
```

## 🎯 Best Practices

### Security

1. **Never commit `.env` files to Git**
   ```bash
   # Verify .gitignore includes
   echo ".env" >> .gitignore
   ```

2. **Use Secret Manager for Production**
   ```bash
   # Store secrets in Secret Manager
   echo -n "sk-your-api-key" | gcloud secrets create api-key \
       --data-file=- \
       --project=YOUR_PROJECT_ID
   
   # Reference in Cloud Run (modify deploy command)
   --set-secrets="API_KEY=api-key:latest"
   ```

3. **Restrict Service Access**
   ```bash
   # Remove public access (require authentication)
   gcloud run services remove-iam-policy-binding SERVICE_NAME \
       --region=REGION \
       --member="allUsers" \
       --role="roles/run.invoker" \
       --project=PROJECT_ID
   ```

### Cost Optimization

1. **Scale to Zero**
   - Keep `--min-instances=0` (default) to avoid idle costs
   - Acceptable for most use cases (cold start ~1-3 seconds)

2. **Right-size Resources**
   ```bash
   # Start small, scale up if needed
   --memory="1Gi" --cpu="1"
   
   # Monitor in Cloud Console → Cloud Run → Metrics
   ```

3. **Set Budget Alerts**
   - Go to [Billing → Budgets](https://console.cloud.google.com/billing)
   - Set alerts at 50%, 90%, 100% of budget

### Performance

1. **Use Health Checks**
   ```python
   @app.route('/health')
   def health():
       return {'status': 'healthy'}, 200
   ```

2. **Optimize Docker Image**
   ```dockerfile
   # Use slim base images
   FROM python:3.12-slim
   
   # Multi-stage builds
   FROM node:18 AS builder
   # ... build steps ...
   FROM node:18-slim
   COPY --from=builder /app/dist ./dist
   
   # Clean caches
   RUN pip install --no-cache-dir -r requirements.txt && \
       pip cache purge
   ```

3. **Enable Request Timeouts**
   ```bash
   --timeout=300  # 5 minutes (default in our scripts)
   ```

### Monitoring

1. **View Metrics**
   - Go to Cloud Run Console → Service → Metrics tab
   - Monitor: Request count, latency, CPU, memory

2. **Set Up Alerts**
   ```bash
   # Create alert for error rate
   gcloud alpha monitoring policies create \
       --notification-channels=CHANNEL_ID \
       --display-name="High Error Rate" \
       --condition-display-name="Error rate > 5%" \
       --condition-threshold-value=5
   ```

3. **Structured Logging**
   ```python
   import json
   import sys
   
   def log(level, message, **kwargs):
       log_entry = {
           'severity': level,
           'message': message,
           **kwargs
       }
       print(json.dumps(log_entry), file=sys.stdout)
   
   log('INFO', 'Request received', user_id=123)
   ```

### Continuous Deployment

For frequent deployments, consider:

1. **Automated Deployment Script**
   ```powershell
   # deploy.ps1 - wrapper script
   git pull
   .\deploy-gcp.ps1 -ProjectId $env:GCP_PROJECT_ID
   ```

2. **Version Tagging**
   ```bash
   # Tag with git commit
   IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME:$(git rev-parse --short HEAD)"
   docker build -t $IMAGE_TAG .
   docker push $IMAGE_TAG
   ```

3. **Blue-Green Deployments**
   ```bash
   # Deploy to staging first
   gcloud run deploy $SERVICE_NAME-staging --image=$IMAGE --no-traffic
   
   # Test staging
   # ... tests ...
   
   # Promote to production
   gcloud run services update-traffic $SERVICE_NAME \
       --to-latest \
       --region=$REGION
   ```

## 📚 Additional Resources

### GCP Documentation

- [Cloud Run Overview](https://cloud.google.com/run/docs)
- [Container Runtime Contract](https://cloud.google.com/run/docs/container-contract)
- [Environment Variables](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Pricing Calculator](https://cloud.google.com/products/calculator)

### Useful Commands

```bash
# List all services
gcloud run services list --project=YOUR_PROJECT_ID

# Describe a service
gcloud run services describe SERVICE_NAME --region=REGION --project=YOUR_PROJECT_ID

# Delete a service
gcloud run services delete SERVICE_NAME --region=REGION --project=YOUR_PROJECT_ID

# View revisions
gcloud run revisions list --service=SERVICE_NAME --region=REGION --project=YOUR_PROJECT_ID

# Roll back to previous revision
gcloud run services update-traffic SERVICE_NAME \
    --to-revisions=REVISION_NAME=100 \
    --region=REGION \
    --project=YOUR_PROJECT_ID

# Update environment variable
gcloud run services update SERVICE_NAME \
    --update-env-vars KEY=VALUE \
    --region=REGION \
    --project=YOUR_PROJECT_ID
```

## 🚨 Important Notes

1. **Python Version Compatibility**
   - If you encounter gcloud issues, check Python version
   - Python 3.13 may have compatibility issues with gcloud
   - Use Python 3.11 or 3.12 if problems occur

2. **Windows-Specific**
   - Use PowerShell (not CMD) for best results
   - Batch script has limited special character support
   - Run PowerShell as Administrator if permission issues occur

3. **First Deployment**
   - First deployment takes longer (4-10 minutes) as Cloud Build creates the image
   - Subsequent deployments are faster (3-6 minutes)
   - Build cache is maintained in the cloud

4. **Service URLs**
   - Format: `https://SERVICE-NAME-HASH-REGION.run.app`
   - URLs persist across deployments
   - HTTPS is automatic (no certificate needed)

## ✅ Quick Reference

### Complete Deployment Checklist

- [ ] Install gcloud CLI
- [ ] Run `gcloud auth login`
- [ ] Enable APIs: `run.googleapis.com`, `cloudbuild.googleapis.com`
- [ ] Create `.env` file with all variables
- [ ] Verify `Dockerfile.backend` exists
- [ ] Run validation: `.\validate-gcp-setup.ps1 -ProjectId YOUR_PROJECT_ID`
- [ ] Deploy: `.\deploy-gcp.ps1 -ProjectId YOUR_PROJECT_ID`
- [ ] Test service URL
- [ ] Check logs for errors

### Emergency Rollback

```bash
# List revisions
gcloud run revisions list --service=SERVICE_NAME --region=REGION

# Route 100% traffic to previous revision
gcloud run services update-traffic SERVICE_NAME \
    --to-revisions=PREVIOUS_REVISION=100 \
    --region=REGION
```

---

**Need Help?**

- Check logs: Cloud Console → Cloud Run → [Service] → Logs
- Validate setup: `.\validate-gcp-setup.ps1 -ProjectId YOUR_PROJECT_ID -Detailed`
- GCP Support: [support.google.com/cloud](https://support.google.com/cloud)

---

*Last Updated: 2024 | For GCP Cloud Run deployment scripts v1.0*
