# 🔄 How to Update Custom LLM URL

## What needs to be changed?

**Primary URL Variable:**
- `CUSTOM_LLM_BASE_URL` - Your custom LLM endpoint

**Note:** There is no `TAVUS_CUSTOM_LLM_URL` in the codebase. If you meant something else, please clarify!

---

## 🏠 Local Development

### 1. Update `.env` file

```bash
# Change this line:
CUSTOM_LLM_BASE_URL=https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io

# To your new URL:
CUSTOM_LLM_BASE_URL=https://your-new-llm-url.azurecontainerapps.io
```

### 2. Restart Docker containers

```bash
docker compose down
docker compose up --build
```

---

## ☁️ Azure Deployment (Production)

### 1. Update GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Update this secret:
- `CUSTOM_LLM_BASE_URL` = `https://your-new-llm-url.azurecontainerapps.io`

### 2. Redeploy

**Option A: Automatic (via GitHub Actions)**
```bash
git commit --allow-empty -m "Trigger redeploy with new LLM URL"
git push
```

**Option B: Manual (via Azure CLI)**
```bash
az containerapp update \
  --name gene-guide-backend \
  --resource-group rg_custom_llm \
  --set-env-vars CUSTOM_LLM_BASE_URL="https://your-new-llm-url.azurecontainerapps.io"
```

---

## 📋 Files to Update (Optional - for reference)

These files contain example/default URLs that you may want to update:

### 1. `env.example` (Line 13)
```bash
CUSTOM_LLM_BASE_URL=https://your-new-llm-url.azurecontainerapps.io
```

### 2. Documentation files (optional)
- `README.md` (line ~130)
- `DEPLOYMENT_GUIDE.md` (lines ~118, 134, 240)
- `DEPLOYMENT_CHECKLIST.md` (line ~23)
- `TAVUS_INTEGRATION_GUIDE.md` (lines ~338, 402)
- `TESTING_GUIDE.md` (lines ~92, 160, 166)

**Note:** These are just documentation/examples. Updating them won't affect functionality, but helps keep docs consistent.

---

## ✅ Verify the Change

### Check Backend Logs

**Local:**
```bash
docker compose logs backend -f --tail 20
```

**Azure:**
```bash
az containerapp logs show \
  -g rg_custom_llm \
  -n gene-guide-backend \
  --tail 20
```

Look for this line on startup:
```
CUSTOM_LLM_BASE_URL: https://your-new-llm-url.azurecontainerapps.io
```

### Test LLM Connection

**Backend should log:**
```
[login] 🔥 Pre-warming custom LLM...
[login] ✅ LLM warmed up successfully (1.23s)
```

**If you see this error:**
```
[login] ❌ LLM pre-warm error: Failed to fetch
```

Then check:
1. Is the new URL correct?
2. Is the LLM service running?
3. Is the API key still valid?

---

## 🔐 Related Secrets to Check

While you're updating URLs, verify these are also correct:

| Secret | Purpose | Example |
|--------|---------|---------|
| `CUSTOM_LLM_BASE_URL` | LLM endpoint | `https://custom-llm-gc.*.azurecontainerapps.io` |
| `CUSTOM_LLM_API_KEY` | LLM auth key | `eb75c854-3f5b-4ed5-b538-1d67a157243a` |
| `CUSTOM_LLM_PERSONA_ID` | GC persona UUID | `9b94acf5-6fcb-4314-9049-fad8d641206d` |

---

## 🆘 Troubleshooting

### "CUSTOM_LLM_BASE_URL: NOT SET" in logs

**Cause:** Environment variable not loaded

**Fix:**
1. Check `.env` file exists and has correct value
2. Restart containers: `docker compose restart backend`
3. Check GitHub secret is set correctly

### LLM warmup fails with timeout

**Cause:** LLM service is slow or down

**Fix:**
1. Check LLM service health: `curl https://your-new-llm-url/healthz`
2. Increase timeout in `src/pages/LoginScreen.tsx` (line 59):
   ```typescript
   signal: AbortSignal.timeout(30000), // 30 seconds instead of 15
   ```

### Condition analysis returns "llm_not_configured"

**Cause:** Backend can't reach LLM

**Fix:**
1. Verify `CUSTOM_LLM_BASE_URL` is accessible from Azure Container Apps
2. Check firewall rules on LLM service
3. Verify API key is correct

---

## 📞 Need Help?

Provide these details:
1. New LLM URL you're trying to use
2. Backend logs (first 30 lines showing env vars)
3. Any error messages from browser console

