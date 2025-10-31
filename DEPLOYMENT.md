# Deployment Guide

## Prerequisites

- Docker Desktop installed and running
- Azure CLI (`az`) installed and authenticated
- Node.js 18+ and Python 3.11+ for local non-Docker dev
- Tavus API key and replica/persona IDs

## Environment Setup

### 1. Create .env file

Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```

Required values:
```ini
TAVUS_API_KEY=your_actual_tavus_api_key
TAVUS_REPLICA_ID=r4317e64d25a
TAVUS_PERSONA_ID=p92464cdb59e
TAVUS_CALLBACK_URL=
CORS_ORIGINS=http://localhost:8090
VITE_TAVUS_BACKEND_URL=http://localhost:8086
```

### 2. Configure Tavus Allowed Origins

**Critical**: Add your frontend origin to Tavus dashboard allowed origins:
- Local dev: `http://localhost:8090`
- Azure: `https://your-frontend-app.azurecontainerapps.io`

No trailing slashes. Exact scheme, host, and port.

---

## Local Development (Docker)

### Build and Run

```bash
# Build both containers
docker compose build

# Start services
docker compose up -d

# View logs
docker compose logs -f backend
docker compose logs -f web

# Stop services
docker compose down
```

### Access

- **Frontend**: http://localhost:8090
- **QA Screen**: http://localhost:8090/qa
- **Backend**: http://localhost:8086

### Rebuild After Changes

```bash
# Backend only
docker compose up -d --build --no-cache backend

# Frontend only
docker compose up -d --build --no-cache web

# Both (full rebuild)
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## Local Development (Without Docker)

### Backend

```powershell
# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Set environment variables
$env:TAVUS_API_KEY="your_key"
$env:TAVUS_REPLICA_ID="r4317e64d25a"
$env:TAVUS_PERSONA_ID="p92464cdb59e"
$env:CORS_ORIGINS="http://localhost:8090"

# Run backend
gunicorn -w 2 -b 0.0.0.0:8086 app:app --log-level info
```

### Frontend

```powershell
# Install dependencies
npm ci

# Run dev server (proxies /tavus to backend)
npm run dev
# Access: http://localhost:8090
```

---

## Azure Deployment

### Prerequisites

1. Azure Container Registry (ACR)
2. Two Azure Container Apps (one for backend, one for frontend)
3. Container Apps Environment

### Step 1: Build and Push Images to ACR

```bash
# Login to Azure
az login

# Set variables
ACR_NAME="yourregistry"
RESOURCE_GROUP="your-resource-group"
BACKEND_IMAGE="gene-guide-backend"
FRONTEND_IMAGE="gene-guide-frontend"

# Build and push backend
az acr build \
  --registry $ACR_NAME \
  --image $BACKEND_IMAGE:latest \
  --file Dockerfile.backend \
  .

# Build and push frontend (with backend URL)
az acr build \
  --registry $ACR_NAME \
  --image $FRONTEND_IMAGE:latest \
  --file Dockerfile.frontend \
  --build-arg VITE_TAVUS_BACKEND_URL=https://your-backend-app.azurecontainerapps.io \
  .
```

### Step 2: Deploy Backend Container App

```bash
BACKEND_APP_NAME="gene-guide-backend"
ENVIRONMENT_NAME="your-containerapp-env"

az containerapp create \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/$BACKEND_IMAGE:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --target-port 8081 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    TAVUS_API_KEY=secretref:tavus-api-key \
    TAVUS_REPLICA_ID=r4317e64d25a \
    TAVUS_PERSONA_ID=p92464cdb59e \
    TAVUS_CALLBACK_URL=https://your-public-webhook.com/tavus/callback \
    CORS_ORIGINS=https://your-frontend-app.azurecontainerapps.io \
  --secrets tavus-api-key=your_actual_tavus_api_key
```

**Get backend FQDN:**
```bash
az containerapp show \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

### Step 3: Rebuild Frontend with Backend URL

```bash
# Use the backend FQDN from step 2
BACKEND_FQDN=$(az containerapp show \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

# Rebuild frontend with correct backend URL
az acr build \
  --registry $ACR_NAME \
  --image $FRONTEND_IMAGE:latest \
  --file Dockerfile.frontend \
  --build-arg VITE_TAVUS_BACKEND_URL=https://$BACKEND_FQDN \
  .
```

### Step 4: Deploy Frontend Container App

```bash
FRONTEND_APP_NAME="gene-guide-frontend"

az containerapp create \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/$FRONTEND_IMAGE:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 0.25 \
  --memory 0.5Gi
```

**Get frontend FQDN:**
```bash
az containerapp show \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

### Step 5: Update Backend CORS_ORIGINS

```bash
FRONTEND_FQDN=$(az containerapp show \
  --name $FRONTEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

az containerapp update \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars CORS_ORIGINS=https://$FRONTEND_FQDN
```

### Step 6: Update Tavus Allowed Origins

Add the frontend FQDN to Tavus dashboard:
- Go to Tavus dashboard → Settings → Allowed Origins
- Add: `https://your-frontend-app.azurecontainerapps.io`

---

## Verification

### Local

1. Open http://localhost:8090/qa
2. Click "Start Video Call"
3. Backend logs should show:
   ```
   request GET /tavus/start
   tavus:start:response status=200
   tavus:start:response:json {'conversation_url': 'https://tavus.daily.co/...', ...}
   ```
4. Browser console should show:
   ```
   [qa] tavus:start response {conversation_url: "https://tavus.daily.co/...", ...}
   [qa] joining Daily with https://tavus.daily.co/...
   [qa] daily:loaded
   [qa] daily:joined-meeting
   ```
5. Video should render in the iframe

### Azure

1. Open `https://your-frontend-app.azurecontainerapps.io/qa`
2. Same flow as local
3. Check logs:
   ```bash
   az containerapp logs show \
     --name $BACKEND_APP_NAME \
     --resource-group $RESOURCE_GROUP \
     --follow
   ```

---

## Troubleshooting

### "Connection failed" on /qa

**Check 1**: Tavus allowed origins
- Ensure your frontend origin is listed in Tavus dashboard
- Match exact: `http://localhost:8090` or `https://your-app.azurecontainerapps.io`

**Check 2**: Backend logs
```bash
docker compose logs -f backend
# or Azure:
az containerapp logs show --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --follow
```
- Should see `tavus:start:response status=200` and JSON with `conversation_url`

**Check 3**: Browser console
- Open DevTools → Console
- Look for `[qa] daily:error` messages
- If "Daily JS not loaded", check Network tab for script load

**Check 4**: CORS
- Backend logs should NOT show CORS errors
- Verify CORS_ORIGINS env var matches your frontend origin

### Video iframe blank

**Check 1**: Open conversation URL directly
- Copy `conversation_url` from backend logs
- Open in new tab: `https://tavus.daily.co/<id>`
- If it loads there but not embedded → origin allowlist issue

**Check 2**: Network tab
- Look for blocked requests to `tavus.daily.co`
- Check response headers: `X-Frame-Options` or `Content-Security-Policy`

### Backend not responding

**Check 1**: Port mapping
- Docker: backend on 8086, web on 8090
- Azure: use FQDN, not localhost

**Check 2**: Health check
```bash
# Local
curl http://localhost:8086/tavus/start

# Azure
curl https://your-backend-app.azurecontainerapps.io/tavus/start
```

---

## Update Deployment

### Backend Code Changes

```bash
# Local Docker
docker compose up -d --build backend

# Azure
az acr build --registry $ACR_NAME --image $BACKEND_IMAGE:latest --file Dockerfile.backend .
az containerapp update --name $BACKEND_APP_NAME --resource-group $RESOURCE_GROUP --image $ACR_NAME.azurecr.io/$BACKEND_IMAGE:latest
```

### Frontend Code Changes

```bash
# Local Docker
docker compose up -d --build --no-cache web

# Azure
az acr build \
  --registry $ACR_NAME \
  --image $FRONTEND_IMAGE:latest \
  --file Dockerfile.frontend \
  --build-arg VITE_TAVUS_BACKEND_URL=https://$BACKEND_FQDN \
  .
az containerapp update --name $FRONTEND_APP_NAME --resource-group $RESOURCE_GROUP --image $ACR_NAME.azurecr.io/$FRONTEND_IMAGE:latest
```

### Environment Variables

```bash
# Update backend env vars
az containerapp update \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars TAVUS_CALLBACK_URL=https://new-webhook.com/callback

# Update secrets
az containerapp update \
  --name $BACKEND_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --replace-secrets tavus-api-key=new_key_value
```

---

## Production Checklist

- [ ] Set strong TAVUS_API_KEY in Azure secrets
- [ ] Configure TAVUS_CALLBACK_URL to public HTTPS endpoint
- [ ] Add production frontend FQDN to Tavus allowed origins
- [ ] Set CORS_ORIGINS to production frontend FQDN (no trailing slash)
- [ ] Enable HTTPS ingress on both Container Apps
- [ ] Configure autoscaling rules based on load
- [ ] Set up monitoring and alerts
- [ ] Test video call end-to-end on production URL
- [ ] Verify backend logs show no callback_url for localhost (only https://)
- [ ] Check Daily join succeeds in browser console

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  User Browser (http://localhost:8090 or Azure FQDN)           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  React App (Vite + shadcn/ui)                         │   │
│  │  - /qa screen with Daily iframe                        │   │
│  │  - Calls /tavus/start, /tavus/end                      │   │
│  └───────────────────┬────────────────────────────────────┘   │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │ HTTP(S)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Flask Backend (port 8086 local / Azure FQDN)                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  app.py (Flask + CORS)                                 │   │
│  │  - GET /tavus/start → POST Tavus API                   │   │
│  │  - POST /tavus/end/<id> → POST Tavus API               │   │
│  └───────────────────┬────────────────────────────────────┘   │
│                      │                                          │
└──────────────────────┼──────────────────────────────────────────┘
                       │ HTTPS (Tavus API)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tavus API (https://tavusapi.com/v2)                           │
│  - POST /conversations → returns conversation_url + id          │
│  - POST /conversations/<id>/end → ends conversation            │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Daily.co (https://tavus.daily.co/<conversation_id>)           │
│  - WebRTC video room                                            │
│  - Embedded via Daily JS in React                              │
└─────────────────────────────────────────────────────────────────┘
```

**Key Flow:**
1. User clicks "Start Video Call" on `/qa`
2. Frontend → `GET /tavus/start` → Backend
3. Backend → `POST https://tavusapi.com/v2/conversations` → Tavus
4. Tavus returns `{ conversation_url: "https://tavus.daily.co/<id>", conversation_id: "<id>" }`
5. Backend → Frontend (JSON)
6. Frontend creates Daily iframe, joins conversation_url after 1500ms warmup
7. Video renders in iframe
8. User clicks "End Call" → `POST /tavus/end/<id>` → Backend → Tavus
9. Daily frame leaves and destroys

---

## Support

For issues:
1. Check backend logs for Tavus API responses
2. Check browser console for Daily events/errors
3. Verify Tavus allowed origins in dashboard
4. Test conversation_url in new browser tab
5. Confirm CORS_ORIGINS matches your frontend origin exactly

