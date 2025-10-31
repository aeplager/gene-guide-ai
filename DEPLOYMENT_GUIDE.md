# 🚀 Azure Container Apps Deployment Guide

## Prerequisites

- Azure subscription with access to `rg_custom_llm` resource group
- GitHub repository for this project
- Azure CLI installed (for manual testing)

---

## Part 1: Azure Portal Setup (One-Time)

### **Step 1: Create Azure Container Registry (ACR)**

**In Azure Portal:**

1. Navigate to **Azure Portal** → Search "**Container registries**"
2. Click **+ Create**
3. Configure:
   - **Subscription**: Your subscription
   - **Resource Group**: `rg_custom_llm` (select existing)
   - **Registry name**: `geneguidellm` (must be globally unique - change if taken)
   - **Location**: `Central US`
   - **Pricing tier**: `Basic`
4. Click **Review + Create** → **Create**
5. **Important**: Note the **Login server** (e.g., `geneguidellm.azurecr.io`)

---

### **Step 2: Verify Container Apps Environment**

✅ **You already have this** - `custom-llm-env` in `rg_custom_llm`

To verify:
```bash
az containerapp env list -g rg_custom_llm --query "[].name" -o tsv
# Should show: custom-llm-env
```

---

### **Step 3: Create/Verify Service Principal for GitHub**

**Option A: Reuse Existing (Recommended)**

If you already have `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` from your legacy-forever deployment, **reuse them**.

Just grant ACR push access:
```bash
ACR_NAME="geneguidellm"
SP_ID="<your-existing-client-id>"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="rg_custom_llm"

az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME
```

**Option B: Create New Service Principal**

Run in **Azure Cloud Shell** (Bash):

```bash
# Set variables
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="rg_custom_llm"
APP_NAME="gene-guide-ai-github-deploy"
ACR_NAME="geneguidellm"

# Create service principal
az ad sp create-for-rbac \
  --name "$APP_NAME" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP \
  --sdk-auth

# Note the output - you'll need:
# - clientId (AZURE_CLIENT_ID)
# - tenantId (AZURE_TENANT_ID)
# - subscriptionId (AZURE_SUBSCRIPTION_ID)

# Grant ACR push access
SP_ID=$(az ad sp list --display-name "$APP_NAME" --query "[0].appId" -o tsv)

az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ContainerRegistry/registries/$ACR_NAME

echo "Service Principal created!"
echo "Client ID: $SP_ID"
```

---

## Part 2: GitHub Repository Setup

### **Step 1: Add GitHub Secrets**

Go to your GitHub repository:
**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these **13 secrets**:

| Secret Name | Description | Where to Get It |
|-------------|-------------|-----------------|
| `AZURE_CLIENT_ID` | Service principal app ID | From Step 3 above |
| `AZURE_TENANT_ID` | Azure AD tenant ID | From Step 3 or `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | From Step 3 or `az account show --query id -o tsv` |
| `TAVUS_API_KEY` | Tavus API key | From Tavus dashboard |
| `TAVUS_REPLICA_ID` | Tavus replica ID | From Tavus (e.g., `r4317e64d25a`) |
| `TAVUS_PERSONA_ID` | Tavus persona ID | From Tavus (e.g., `p70ec11f62ec`) |
| `DB_CONNECTION_STRING` | PostgreSQL connection string | Your Azure PostgreSQL connection |
| `COMPANY_ID` | Company UUID | Your company UUID |
| `JWT_SECRET` | JWT signing secret | Generate: `openssl rand -hex 32` |
| `CUSTOM_LLM_BASE_URL` | Custom LLM base URL | `https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io` |
| `CUSTOM_LLM_API_KEY` | Custom LLM API key | Your custom LLM key |
| `CUSTOM_LLM_PERSONA_ID` | Custom LLM persona ID | Your genetics counselor persona UUID |

**Example Values:**

```bash
AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789012
AZURE_TENANT_ID=87654321-4321-4321-4321-210987654321
AZURE_SUBSCRIPTION_ID=abcdef12-3456-7890-abcd-ef1234567890
TAVUS_API_KEY=tavus_api_********************************
TAVUS_REPLICA_ID=r4317e64d25a
TAVUS_PERSONA_ID=p70ec11f62ec
DB_CONNECTION_STRING=postgresql://user:password@dbcustomllm.postgres.database.azure.com:5432/agentic_core?sslmode=require
COMPANY_ID=dbb46378-0043-4dbb-aed3-393caf2d57b0
JWT_SECRET=your-super-secret-jwt-key-here-generate-with-openssl
CUSTOM_LLM_BASE_URL=https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io
CUSTOM_LLM_API_KEY=eb75c854-3f5b-4ed5-b538-1d67a157243a
CUSTOM_LLM_PERSONA_ID=9b94acf5-6fcb-4314-9049-fad8d641206d
```

---

### **Step 2: Verify GitHub Actions Workflow**

The workflow file `.github/workflows/deploy.yml` has been created.

**Review it to ensure:**
- ACR name matches: `geneguidellm.azurecr.io` (or your custom name)
- Resource group: `rg_custom_llm`
- Environment: `custom-llm-env`

---

## Part 3: Deploy

### **Option 1: Automatic Deployment (Recommended)**

1. Commit and push to `main` branch:
   ```bash
   git add .
   git commit -m "Add Azure deployment workflow"
   git push origin main
   ```

2. Monitor deployment:
   - Go to your GitHub repo → **Actions** tab
   - Click on the running workflow
   - Watch the logs

3. After ~5-10 minutes, you'll see:
   ```
   Backend:  https://gene-guide-backend.ashydune-c5455a7b.centralus.azurecontainerapps.io
   Frontend: https://gene-guide-frontend.ashydune-c5455a7b.centralus.azurecontainerapps.io
   ```

---

### **Option 2: Manual Testing (Before GitHub Actions)**

**Test locally with Azure CLI:**

```bash
# Login to Azure
az login

# Login to ACR
az acr login --name geneguidellm

# Build and push backend
docker build -t geneguidellm.azurecr.io/gene-guide-backend:test -f Dockerfile.backend .
docker push geneguidellm.azurecr.io/gene-guide-backend:test

# Deploy backend
az containerapp up \
  --name gene-guide-backend \
  --resource-group rg_custom_llm \
  --environment custom-llm-env \
  --image geneguidellm.azurecr.io/gene-guide-backend:test \
  --target-port 8081 \
  --ingress external

# Get backend URL
BACKEND_URL=$(az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Backend URL: https://$BACKEND_URL"

# Build and push frontend (with backend URL)
docker build -t geneguidellm.azurecr.io/gene-guide-frontend:test \
  --build-arg VITE_TAVUS_BACKEND_URL=https://$BACKEND_URL \
  -f Dockerfile.frontend .
docker push geneguidellm.azurecr.io/gene-guide-frontend:test

# Deploy frontend
az containerapp up \
  --name gene-guide-frontend \
  --resource-group rg_custom_llm \
  --environment custom-llm-env \
  --image geneguidellm.azurecr.io/gene-guide-frontend:test \
  --target-port 80 \
  --ingress external

# Get frontend URL
FRONTEND_URL=$(az containerapp show -g rg_custom_llm -n gene-guide-frontend --query "properties.configuration.ingress.fqdn" -o tsv)
echo "Frontend URL: https://$FRONTEND_URL"
```

**Set backend environment variables:**
```bash
BACKEND_CONTAINER=$(az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.template.containers[0].name" -o tsv)

az containerapp update \
  --name gene-guide-backend \
  --resource-group rg_custom_llm \
  --container-name "$BACKEND_CONTAINER" \
  --set-env-vars \
    TAVUS_API_KEY="your-tavus-key" \
    TAVUS_REPLICA_ID="r4317e64d25a" \
    TAVUS_PERSONA_ID="p70ec11f62ec" \
    DB_CONNECTION_STRING="your-postgres-connection-string" \
    COMPANY_ID="your-company-uuid" \
    JWT_SECRET="your-jwt-secret" \
    JWT_EXP_HOURS="12" \
    CUSTOM_LLM_BASE_URL="https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io" \
    CUSTOM_LLM_API_KEY="your-custom-llm-key" \
    CUSTOM_LLM_PERSONA_ID="9b94acf5-6fcb-4314-9049-fad8d641206d" \
    TAVUS_CUSTOM_LLM_ENABLE="true" \
    CORS_ORIGINS="https://$FRONTEND_URL"
```

---

## Part 4: Post-Deployment Verification

### **Test Backend Health**

```bash
# Get backend URL
BACKEND_URL=$(az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.configuration.ingress.fqdn" -o tsv)

# Test health endpoint
curl https://$BACKEND_URL/

# Test login endpoint
curl -X POST https://$BACKEND_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### **Test Frontend**

```bash
# Get frontend URL
FRONTEND_URL=$(az containerapp show -g rg_custom_llm -n gene-guide-frontend --query "properties.configuration.ingress.fqdn" -o tsv)

# Open in browser
echo "Frontend: https://$FRONTEND_URL"
```

### **View Logs**

```bash
# Backend logs
az containerapp logs show -g rg_custom_llm -n gene-guide-backend --follow

# Frontend logs
az containerapp logs show -g rg_custom_llm -n gene-guide-frontend --follow
```

---

## Part 5: Troubleshooting

### **Issue: Container app not starting**

**Check logs:**
```bash
az containerapp logs show -g rg_custom_llm -n gene-guide-backend --tail 100
```

**Common issues:**
- Missing environment variables → Set them via `az containerapp update`
- Invalid DB connection string → Verify with `psql`
- Port mismatch → Backend should be 8081, frontend 80

---

### **Issue: CORS errors**

**Update backend CORS:**
```bash
FRONTEND_URL=$(az containerapp show -g rg_custom_llm -n gene-guide-frontend --query "properties.configuration.ingress.fqdn" -o tsv)
BACKEND_CONTAINER=$(az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.template.containers[0].name" -o tsv)

az containerapp update \
  --name gene-guide-backend \
  --resource-group rg_custom_llm \
  --container-name "$BACKEND_CONTAINER" \
  --set-env-vars CORS_ORIGINS="https://$FRONTEND_URL"
```

---

### **Issue: Tavus video not working**

**Verify Tavus env vars:**
```bash
az containerapp show -g rg_custom_llm -n gene-guide-backend \
  --query "properties.template.containers[0].env[?name=='TAVUS_API_KEY']" -o table
```

**Check if all are set:**
- `TAVUS_API_KEY`
- `TAVUS_REPLICA_ID`
- `TAVUS_PERSONA_ID`
- `TAVUS_CUSTOM_LLM_ENABLE=true`

---

## Part 6: Resource Cleanup (Optional)

**To delete everything:**
```bash
# Delete container apps
az containerapp delete -g rg_custom_llm -n gene-guide-backend --yes
az containerapp delete -g rg_custom_llm -n gene-guide-frontend --yes

# Delete ACR (if needed)
az acr delete -g rg_custom_llm -n geneguidellm --yes
```

---

## Summary

**One-time setup:**
1. ✅ Create ACR: `geneguidellm`
2. ✅ Create/reuse service principal
3. ✅ Add 13 GitHub secrets

**Every deployment:**
1. Push to `main` branch
2. GitHub Actions builds & deploys automatically
3. Access app at Azure-provided URLs

**Estimated deployment time:** 5-10 minutes

**Estimated cost:** ~$30-50/month (Basic tier ACR + 2 Container Apps)

---

## Need Help?

**View deployment status:**
- GitHub repo → **Actions** tab

**View Azure resources:**
- Azure Portal → Resource Groups → `rg_custom_llm`

**View logs:**
```bash
az containerapp logs show -g rg_custom_llm -n gene-guide-backend --follow
```

