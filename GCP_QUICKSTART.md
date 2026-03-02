# GCP Cloud Run - Quick Start

> **Complete Guide:** See [GCP_CLOUD_RUN_DEPLOYMENT.md](./GCP_CLOUD_RUN_DEPLOYMENT.md) for detailed documentation.

## 🚀 Quick Deploy

### Windows (PowerShell) - Recommended
```powershell
# 1. One-time setup
gcloud auth login

# 2. Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project=YOUR_PROJECT_ID

# 3. Validate setup
.\validate-gcp-setup.ps1 -ProjectId "YOUR_PROJECT_ID"

# 4. Deploy
.\deploy-gcp.ps1 -ProjectId "YOUR_PROJECT_ID"
```

### Linux/macOS/Windows (Bash)
> **Windows users:** Use Git Bash, WSL, or any bash shell

```bash
# 1. One-time setup
gcloud auth login

# 2. Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project=YOUR_PROJECT_ID

# 3. Make script executable (first time only)
chmod +x deploy-gcp.sh

# 4. Deploy
./deploy-gcp.sh YOUR_PROJECT_ID
```

### Windows (CMD/Batch)
```batch
REM 1. One-time setup
gcloud auth login

REM 2. Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com --project=YOUR_PROJECT_ID

REM 3. Deploy
deploy-gcp.bat YOUR_PROJECT_ID
```

## 📁 Files

| File | Purpose |
|------|---------|
| `deploy-gcp.sh` | Bash deployment script (Linux/macOS) |
| `deploy-gcp.ps1` | PowerShell deployment script (Windows) |
| `deploy-gcp.bat` | Batch deployment script (Windows) |
| `validate-gcp-setup.ps1` | Setup validation tool (Windows) |
| `GCP_CLOUD_RUN_DEPLOYMENT.md` | Complete documentation |
| `.env` | Environment variables (create from env.example) |
| `Dockerfile.backend` | Docker configuration |

## ⚙️ Configuration

### Basic Deploy
```powershell
.\deploy-gcp.ps1 -ProjectId "my-project-123"
```

### Custom Configuration
```powershell
.\deploy-gcp.ps1 `
    -ProjectId "my-project-123" `
    -ServiceName "my-api" `
    -Region "us-west1" `
    -Memory "2Gi" `
    -Cpu "2"
```

### Bash (Positional Args)
```bash
./deploy-gcp.sh PROJECT_ID [SERVICE_NAME] [REGION] [MEMORY] [CPU]
./deploy-gcp.sh my-project-123 my-api us-west1 2Gi 2
```

## 🔧 Default Values

- **Service Name:** `legacy-forever-api`
- **Region:** `us-central1`
- **Memory:** `4Gi`
- **CPU:** `4`
- **Port:** `8081`
- **Min Instances:** `0` (scales to zero)
- **Max Instances:** `10`
- **Timeout:** `300` seconds

## 🐛 Common Issues

### Cloud Build API Not Enabled
```bash
gcloud services enable cloudbuild.googleapis.com --project=YOUR_PROJECT_ID
```

### Cloud Run API Not Enabled
```bash
gcloud services enable run.googleapis.com --project=YOUR_PROJECT_ID
```

### Environment Variable Errors
- Use PowerShell script (better special character handling)
- Verify `.env` file has no syntax errors

### View Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=SERVICE_NAME" \
    --limit 50 --project=YOUR_PROJECT_ID
```

## 🔐 Environment Variables

The scripts automatically:
- ✅ Filter out comments (lines starting with `#`)
- ✅ Handle special characters (`#`, `%`, `=`, spaces)
- ✅ Properly quote and escape values
- ✅ Skip empty lines

**Example `.env`:**
```env
# Comments are ignored
DATABASE_URL=postgresql://user:pass%2312@host:5432/db
API_KEY=sk-proj-abc123-xyz
PASSWORD=myP@ss#123
CALLBACK_URL=https://example.com/path?token=abc#section
```

## 📊 After Deployment

### Get Service URL
```bash
gcloud run services describe SERVICE_NAME \
    --region=REGION \
    --project=PROJECT_ID \
    --format="value(status.url)"
```

### Test Deployment
```bash
curl https://your-service-url.run.app
curl https://your-service-url.run.app/health
```

### View in Console
```
https://console.cloud.google.com/run?project=YOUR_PROJECT_ID
```

## 📖 Full Documentation

See [GCP_CLOUD_RUN_DEPLOYMENT.md](./GCP_CLOUD_RUN_DEPLOYMENT.md) for:
- Detailed setup instructions
- Troubleshooting guide
- Best practices
- Security recommendations
- Cost optimization tips
- Monitoring & alerts

## 🆘 Need Help?

1. **Validate Setup:**
   ```powershell
   .\validate-gcp-setup.ps1 -ProjectId YOUR_PROJECT_ID -Detailed
   ```

2. **Check Logs:**
   - Cloud Console → Cloud Run → [Service] → Logs
   - Or use gcloud: `gcloud logging read ...`

3. **Documentation:**
   - [Complete Guide](./GCP_CLOUD_RUN_DEPLOYMENT.md)
   - [GCP Cloud Run Docs](https://cloud.google.com/run/docs)

---

**Deployment Time:** ~4-10 minutes (first time), ~3-6 minutes (updates)

**Estimated Costs:** Free tier includes 2 million requests/month + 360,000 GB-seconds of compute time + 120 build-minutes/day
