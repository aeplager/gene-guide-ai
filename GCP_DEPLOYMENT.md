# Gene Guide AI - Comprehensive GCP Cloud Run Deployment Guide

## Overview

This guide provides complete instructions for deploying Gene Guide AI to Google Cloud Platform Cloud Run. This serverless platform automatically scales your application and costs ~75% less than traditional container services.

**Key Benefits:**
- ✅ Automatic scaling (0-100 instances in seconds)
- ✅ Pay-per-request pricing (~$3-9/month for typical usage)
- ✅ One-command deployment in 5-10 minutes
- ✅ Integrated logging, monitoring, and diagnostics
- ✅ Automatic SSL/TLS certificates
- ✅ No infrastructure management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GCP Cloud Run Services                   │
├──────────────────────────────┬──────────────────────────────┤
│                              │                              │
│  gene-guide-api              │  gene-guide-web              │
│  (Python Flask)              │  (React + Nginx)             │
│  Port: 8081                  │  Port: 80                    │
│  Memory: 512Mi               │  Memory: 256Mi               │
│  CPU: 1 vCPU                 │  CPU: 1 vCPU                 │
│                              │                              │
│  ✓ Auto-scales 0-100         │  ✓ Auto-scales 0-100         │
│  ✓ Health checks             │  ✓ Health checks             │
│  ✓ Request-based billing     │  ✓ Request-based billing     │
└──────────────────────────────┴──────────────────────────────┘
         ↓                                    ↓
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud SQL (PostgreSQL)                  │
│              (Managed, automated backups)                   │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│              External APIs                                  │
│  • Tavus API (video generation)                            │
│  • Vapi.ai (voice AI)                                       │
│  • Custom LLM Service                                       │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Required Tools

1. **Google Cloud SDK** - [Install](https://cloud.google.com/sdk/docs/install)
   ```bash
   gcloud --version  # Should show version 400+
   ```

2. **Docker Desktop** - [Install](https://www.docker.com/products/docker-desktop)
   ```bash
   docker --version  # Should show 20.10+
   ```

3. **Git** - [Install](https://git-scm.com/downloads)
   ```bash
   git --version
   ```

### GCP Project Setup

1. Create a GCP project
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project
   - Enable billing

2. Set your project ID
   ```bash
   export PROJECT_ID="your-project-id"
   gcloud config set project $PROJECT_ID
   ```

3. Authenticate
   ```bash
   gcloud auth login
   ```

## Deployment Process

### Phase 1: Validation (5 minutes)

Validate your environment before deployment:

```bash
# Linux/macOS
python3 validate-gcp-setup.py $PROJECT_ID

# Windows
python validate-gcp-setup.py $PROJECT_ID
```

This checks:
- ✓ Required tools installed
- ✓ GCP authentication and project access
- ✓ Required APIs enabled (or can be enabled)
- ✓ .env file with required variables
- ✓ Dockerfiles present and valid

**Troubleshooting validation failures:**
- Missing `gcloud`? [Install Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- Missing `docker`? [Install Docker Desktop](https://www.docker.com/products/docker-desktop)
- API errors? Continue - setup script will enable them
- Missing `.env`? Copy `env-gcp.example` to `.env` and update values

### Phase 2: One-Time Project Setup (5 minutes)

Only run this once per GCP project:

```bash
# Linux/macOS
chmod +x setup-gcp.sh
./setup-gcp.sh $PROJECT_ID

# Windows PowerShell
python setup-gcp.sh $PROJECT_ID
```

This script:
- ✅ Enables required Google Cloud APIs
- ✅ Creates Artifact Registry repository
- ✅ Creates service accounts with proper IAM roles
- ✅ Configures Cloud Build (optional CI/CD)

**APIs enabled:**
- Cloud Run API (`run.googleapis.com`)
- Artifact Registry API (`artifactregistry.googleapis.com`)
- Cloud Build API (`cloudbuild.googleapis.com`)
- Compute Engine API (`compute.googleapis.com`)
- Cloud Logging API (`logging.googleapis.com`)

### Phase 3: Configure Environment (.env)

1. Copy the GCP example configuration:
   ```bash
   cp env-gcp.example .env
   ```

2. Update required variables:

   ```bash
   # GCP Configuration
   GCP_PROJECT_ID=your-project-id
   GCP_REGION=us-central1

   # Tavus Configuration
   TAVUS_API_KEY=your_api_key
   TAVUS_REPLICA_ID=r4317e64d25a
   TAVUS_PERSONA_ID=p92464cdb59e

   # Database (Cloud SQL)
   DB_CONNECTION_STRING=postgresql+asyncpg://user:password@/dbname?host=/cloudsql/PROJECT_ID:REGION:instance

   # JWT
   JWT_SECRET=your-super-secret-key-min-32-chars

   # Frontend APIs
   VITE_VAPI_PUBLIC_KEY=pk_your_key
   CUSTOM_LLM_API_KEY=your_key
   CUSTOM_LLM_PERSONA_ID=your_id
   ```

3. Replace placeholders:
   - Replace `PROJECT_ID` with your GCP project ID
   - Replace `REGION` with your GCP region (e.g., `us-central1`)
   - Update all API keys with real values

### Phase 4: Deploy to Cloud Run (5-10 minutes)

**Linux/macOS (Bash):**
```bash
chmod +x deploy-gcp.sh
./deploy-gcp.sh $PROJECT_ID us-central1
```

**Windows (PowerShell):**
```powershell
.\deploy-gcp-powershell.ps1 -ProjectId "your-project-id" -Region "us-central1"
```

**Windows (Batch/CMD):**
```batch
deploy-gcp.bat your-project-id us-central1
```

### Deployment Steps

The deployment script automatically:

1. **Validates prerequisites** - Checks gcloud, Docker, and git
2. **Authenticates with GCP** - Sets up credentials
3. **Configures Artifact Registry** - Creates image repository
4. **Builds backend image** - Python Flask API with optimizations
5. **Builds frontend image** - React SPA with Nginx
6. **Pushes to registry** - Uploads images to GCP
7. **Deploys backend** - Starts gene-guide-api Cloud Run service
8. **Deploys frontend** - Starts gene-guide-web Cloud Run service
9. **Configures environment variables** - Sets all secrets from .env
10. **Returns URLs** - Shows your deployed service URLs

## Accessing Your Application

After successful deployment, you'll see:

```
Backend API
  URL: https://gene-guide-api-xxxxxxxxxx.us-central1.run.app
  Health: https://gene-guide-api-xxxxxxxxxx.us-central1.run.app/health

Frontend
  URL: https://gene-guide-web-xxxxxxxxxx.us-central1.run.app
```

### Health Checks

Verify services are running:

```bash
# Backend health
curl https://gene-guide-api-{PROJECT_NUMBER}.us-central1.run.app/health

# Frontend health
curl https://gene-guide-web-{PROJECT_NUMBER}.us-central1.run.app/
```

Both should return HTTP 200 with a valid response.

## Monitoring & Logs

### View Logs

```bash
# Last 50 backend logs
gcloud run logs read gene-guide-api --limit=50

# Last 50 frontend logs
gcloud run logs read gene-guide-web --limit=50

# Real-time backend logs
gcloud run logs read gene-guide-api --follow

# Logs from last hour
gcloud run logs read gene-guide-api --limit=100 --format=json | grep timestamp
```

### Cloud Console

Access comprehensive logs and metrics:

1. [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on `gene-guide-api` or `gene-guide-web`
3. View metrics, logs, and revisions

### Key Metrics to Monitor

| Metric | Healthy Range | Warning |
|--------|---------------|---------|
| Error Rate | < 1% | > 5% |
| P95 Latency | < 500ms | > 2000ms |
| Memory Usage | < 60% | > 80% |
| CPU Usage | < 40% | > 80% |

## Updating Your Application

### Update Code and Redeploy

```bash
# Make changes to code
git add .
git commit -m "Update description"
git push origin main

# Redeploy
./deploy-gcp.sh $PROJECT_ID
```

The deployment script rebuilds images and updates services automatically.

### Blue-Green Deployments

Cloud Run supports traffic splitting for zero-downtime updates:

```bash
# Deploy new version
gcloud run deploy gene-guide-api --image new-image --region us-central1

# Split traffic: 90% old, 10% new
gcloud run update gene-guide-api \
  --update-traffic old-revision=90,new-revision=10

# After validation, gradually increase new traffic
gcloud run update gene-guide-api --update-traffic new-revision=100
```

## Database Configuration

### Cloud SQL Connection

For managed PostgreSQL:

1. Create Cloud SQL instance
   ```bash
   gcloud sql instances create gene-guide-db \
     --database-version POSTGRES_15 \
     --tier db-f1-micro \
     --region us-central1
   ```

2. Update connection string in `.env`:
   ```bash
   DB_CONNECTION_STRING=postgresql+asyncpg://user:password@/dbname?host=/cloudsql/PROJECT_ID:us-central1:gene-guide-db
   ```

3. Redeploy
   ```bash
   ./deploy-gcp.sh $PROJECT_ID
   ```

## Scaling Configuration

Cloud Run automatically scales based on incoming requests.

### Adjust Scaling Limits

```bash
# Set minimum instances (always running)
gcloud run services update gene-guide-api \
  --min-instances=1 \
  --region=us-central1

# Set maximum instances (cost limit)
gcloud run services update gene-guide-api \
  --max-instances=50 \
  --region=us-central1
```

### Memory and CPU Allocation

Adjust resource allocation:

```bash
# 1 vCPU + 512Mi RAM (default backend)
gcloud run services update gene-guide-api \
  --memory=512Mi \
  --cpu=1

# 2 vCPU + 2Gi RAM (for heavy API calls)
gcloud run services update gene-guide-api \
  --memory=2Gi \
  --cpu=2
```

**Cost Impact Example:**
- 512Mi Memory + 1vCPU = ~30% lower cost
- 2Gi Memory + 2vCPU = ~3x higher cost but 10x faster

## Cost Optimization

### Estimate Monthly Cost

For typical usage (100K requests/month):
- **Backend:** ~$3-5
- **Frontend:** ~$1-2
- **Database:** ~$10-15
- **Total:** ~$14-22/month

### Cost Reduction Strategies

1. **Set min-instances=0** (auto-scale to zero when not in use)
   ```bash
   gcloud run services update gene-guide-api --min-instances=0
   ```

2. **Reduce memory on frontend** (256Mi is typical)
   ```bash
   gcloud run services update gene-guide-web --memory=256Mi
   ```

3. **Use cheaper regions** (e.g., `us-central1` is cheaper than `europe-west1`)

4. **Cache responses** in frontend with Nginx

## Troubleshooting

### Service Won't Start

```bash
# Check deployment logs
gcloud run logs read gene-guide-api --limit=100 --format=json | jq '.severity, .jsonPayload.error'

# Check service status
gcloud run services describe gene-guide-api

# Check revisions
gcloud run revisions list --service=gene-guide-api
```

### High Memory Usage

```bash
# Check if database queries are slow
gcloud sql instances describe gene-guide-db

# Consider increasing Cloud SQL instance size
gcloud sql instances patch gene-guide-db --tier=db-n1-standard-1
```

### Cold Starts

If services take >5 seconds to respond after inactivity:

1. Set `min-instances=1` on backend:
   ```bash
   gcloud run services update gene-guide-api --min-instances=1
   ```

2. Add a scheduler to warm the LLM:
   ```bash
   gcloud scheduler jobs create app-engine warm-llm \
     --schedule="*/10 * * * *" \
     --uri=https://gene-guide-api-xxx.run.app/health
   ```

### Deployment Failures

**Image push fails:**
```bash
# Reconfigure Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
docker push your-image
```

**Permission errors:**
```bash
# Check IAM roles
gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" | grep your-account

# Grant missing permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=user:your-email@example.com \
  --role=roles/run.admin
```

## Rolling Back

If a deployment has issues, quickly revert to a previous version:

```bash
# List recent revisions
gcloud run revisions list --service=gene-guide-api --limit=5

# Route traffic to previous revision
gcloud run services update gene-guide-api \
  --update-traffic <previous-revision-id>=100

# Delete current revision if needed
gcloud run revisions delete <problematic-revision-id> --quiet
```

## Security Best Practices

1. **Use secrets for sensitive data**
   ```bash
   echo -n "secret-value" | gcloud secrets create api-key --data-file=-
   ```

2. **Restrict Cloud Run access**
   ```bash
   # Require authentication (remove --allow-unauthenticated)
   gcloud run services update gene-guide-api --no-allow-unauthenticated
   ```

3. **Enable VPC Connector for private databases**
   ```bash
   gcloud compute networks vpc-access connectors create gene-guide-connector \
     --network default --region us-central1 --range 10.8.0.0/28
   ```

4. **Use Cloud Armor for DDoS protection**
   - [Cloud Armor Setup](https://cloud.google.com/armor/docs)

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Cloud Run Best Practices](https://cloud.google.com/run/docs/quickstarts/build-and-deploy)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [GCP Support Community](https://stackoverflow.com/questions/tagged/google-cloud-platform)

## Success!

Your Gene Guide AI application is now running on Google Cloud Platform. Visit your frontend URL to start using the application!

For updates or issues, see the deployment checklist or troubleshooting section above.
