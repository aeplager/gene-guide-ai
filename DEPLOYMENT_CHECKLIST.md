# 🚀 Azure Deployment Checklist

## Pre-Deployment (One-Time Setup)

### Azure Portal
- [ ] Create ACR: `geneguidellm` in `rg_custom_llm`
- [ ] Note ACR login server: `geneguidellm.azurecr.io`
- [ ] Verify Container Apps Environment exists: `custom-llm-env`
- [ ] Create/reuse Service Principal for GitHub OIDC
- [ ] Grant Service Principal `Contributor` role on `rg_custom_llm`
- [ ] Grant Service Principal `AcrPush` role on ACR

### GitHub Secrets (13 total)
- [ ] `AZURE_CLIENT_ID` - Service principal app ID
- [ ] `AZURE_TENANT_ID` - Azure AD tenant ID  
- [ ] `AZURE_SUBSCRIPTION_ID` - Azure subscription ID
- [ ] `TAVUS_API_KEY` - From Tavus dashboard
- [ ] `TAVUS_REPLICA_ID` - `r4317e64d25a` (or your replica)
- [ ] `TAVUS_PERSONA_ID` - `p70ec11f62ec` (updated persona)
- [ ] `DB_CONNECTION_STRING` - PostgreSQL connection string
- [ ] `COMPANY_ID` - Your company UUID
- [ ] `JWT_SECRET` - Generate with `openssl rand -hex 32`
- [ ] `CUSTOM_LLM_BASE_URL` - Your custom LLM URL
- [ ] `CUSTOM_LLM_API_KEY` - Your custom LLM API key
- [ ] `CUSTOM_LLM_PERSONA_ID` - Genetics counselor persona UUID

### Repository Files
- [ ] `.github/workflows/deploy.yml` exists
- [ ] `Dockerfile.backend` exists
- [ ] `Dockerfile.frontend` exists
- [ ] `nginx.conf` exists
- [ ] All environment variables validated in `.env.example`

---

## Deployment Steps

### 1. Update Code
- [ ] Update `TAVUS_PERSONA_ID` in `.env` to `p70ec11f62ec`
- [ ] Test locally with `docker compose up --build`
- [ ] Verify video shows up at `http://localhost:8090/qa`

### 2. Commit & Push
```bash
git add .
git commit -m "Deploy to Azure Container Apps"
git push origin main
```

### 3. Monitor GitHub Actions
- [ ] Go to GitHub repo → **Actions** tab
- [ ] Click on running workflow
- [ ] Watch for "Backend deployed at: https://..."
- [ ] Watch for "Frontend deployed at: https://..."
- [ ] Verify no errors in logs

### 4. Post-Deployment Verification
- [ ] Open frontend URL in browser
- [ ] Test login with valid credentials
- [ ] Navigate to `/introduction` and save genetic data
- [ ] Navigate to `/conditions` and verify AI analysis
- [ ] Navigate to `/qa` and test video call
- [ ] Verify camera/microphone permissions work
- [ ] Verify Tavus video appears within 10 seconds
- [ ] Test "End Session" button

---

## Troubleshooting Checklist

### Backend Not Starting
- [ ] Check logs: `az containerapp logs show -g rg_custom_llm -n gene-guide-backend --tail 100`
- [ ] Verify all env vars set: `az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.template.containers[0].env" -o table`
- [ ] Test DB connection: `psql <DB_CONNECTION_STRING>`

### CORS Errors
- [ ] Backend CORS_ORIGINS includes frontend URL
- [ ] Frontend can access backend health endpoint: `curl https://<backend-url>/`
- [ ] Browser console shows no CORS preflight errors

### Tavus Video Not Working
- [ ] Backend logs show Tavus conversation started
- [ ] Frontend console shows `daily:joined-meeting` event
- [ ] Container div is visible (not hidden)
- [ ] Camera/microphone permissions granted

### Database Errors
- [ ] DB_CONNECTION_STRING is correct (use `postgresql://` not `postgresql+psycopg2://`)
- [ ] User exists in `public.users` table
- [ ] Firewall allows Azure IPs
- [ ] SSL mode is correct (`sslmode=require`)

---

## Success Criteria

✅ **Backend deployed:** `https://gene-guide-backend.*.centralus.azurecontainerapps.io`  
✅ **Frontend deployed:** `https://gene-guide-frontend.*.centralus.azurecontainerapps.io`  
✅ **Login works:** User can authenticate  
✅ **Data saves:** Genetic info persists to DB  
✅ **AI analysis works:** Condition screen shows generated content  
✅ **Video works:** Tavus video appears and responds  
✅ **CORS configured:** Backend allows frontend origin  
✅ **Logs clean:** No errors in container logs  

---

## Quick Commands Reference

### View Logs
```bash
# Backend logs
az containerapp logs show -g rg_custom_llm -n gene-guide-backend --follow

# Frontend logs  
az containerapp logs show -g rg_custom_llm -n gene-guide-frontend --follow
```

### Get URLs
```bash
# Backend URL
az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.configuration.ingress.fqdn" -o tsv

# Frontend URL
az containerapp show -g rg_custom_llm -n gene-guide-frontend --query "properties.configuration.ingress.fqdn" -o tsv
```

### Update Environment Variables
```bash
BACKEND_CONTAINER=$(az containerapp show -g rg_custom_llm -n gene-guide-backend --query "properties.template.containers[0].name" -o tsv)

az containerapp update \
  --name gene-guide-backend \
  --resource-group rg_custom_llm \
  --container-name "$BACKEND_CONTAINER" \
  --set-env-vars KEY="value"
```

### Restart Container Apps
```bash
# Backend
az containerapp revision restart -g rg_custom_llm -n gene-guide-backend

# Frontend
az containerapp revision restart -g rg_custom_llm -n gene-guide-frontend
```

---

## Estimated Timeline

| Task | Duration |
|------|----------|
| Azure Portal setup | 10 minutes |
| GitHub secrets setup | 5 minutes |
| First deployment | 8-10 minutes |
| Verification & testing | 10 minutes |
| **Total** | **~35 minutes** |

Subsequent deployments: **5-8 minutes** (automatic via GitHub Actions)

