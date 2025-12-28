# GitHub Actions Secrets Checklist

This document lists **ALL** secrets required for the GitHub Actions deployment workflow.

## How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add each secret below

---

## ✅ Implementation Status

**All recording configuration changes are implemented:**
- ✅ `app.py` - Recording logic added
- ✅ `docker-compose.yml` - Recording env vars added
- ✅ `.github/workflows/deploy.yml` - Recording secrets added
- ✅ `env.example` - Recording template added
- ✅ `RECORDING_CONFIGURATION.md` - Documentation created
- ✅ `RECORDING_IMPLEMENTATION_SUMMARY.md` - Summary created

---

## 📋 Required GitHub Secrets

### 🔐 Azure Authentication (OIDC)
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AZURE_CLIENT_ID` | Azure Service Principal App (Client) ID | `bfd53774-3d65-4e75-8965-500df2b3dcf5` |
| `AZURE_TENANT_ID` | Azure Active Directory Tenant ID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `AZURE_SUBSCRIPTION_ID` | Azure Subscription ID | `94b2d828-cf25-42e0-b15e-ca7aa12384c3` |

### 🐳 Azure Container Registry (ACR)
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `ACR_USERNAME` | Azure Container Registry username | `geneguidellm` |
| `ACR_PASSWORD` | Azure Container Registry password | `your-acr-password-here` |

### 🎥 Tavus Configuration
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `TAVUS_API_KEY` | Tavus API key | `tvsk_1234567890abcdef` |
| `TAVUS_REPLICA_ID` | Tavus replica (avatar) ID | `r4317e64d25a` |
| `TAVUS_PERSONA_ID` | Tavus persona (AI personality) ID | `p70ec11f62ec` |

### 📹 Tavus Recording (NEW - Optional)
| Secret Name | Description | Example Value | Required? |
|-------------|-------------|---------------|-----------|
| `TAVUS_ENABLE_RECORDING` | Enable/disable recording | `false` or `true` | ⚠️ **Add this** |
| `TAVUS_RECORDING_S3_BUCKET_NAME` | AWS S3 bucket name | `your-tavus-recordings` | Only if recording=true |
| `TAVUS_RECORDING_S3_BUCKET_REGION` | AWS S3 region | `us-east-1` | Only if recording=true |
| `TAVUS_AWS_ASSUME_ROLE_ARN` | AWS IAM role ARN | `arn:aws:iam::123:role/TavusRole` | Only if recording=true |

### 🗄️ Database Configuration
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `DB_CONNECTION_STRING` | PostgreSQL connection string | `postgresql://user:pass@dbhost.azure.com:5432/db?sslmode=require` |
| `COMPANY_ID` | Company/organization ID | `dbb46378-0043-4dbb-aed3-393caf2d57b0` |

### 🔑 JWT Authentication
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `JWT_SECRET` | Secret key for JWT signing | `your-random-secret-key-here-change-in-production` |

### 🤖 Custom LLM Configuration
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `CUSTOM_LLM_BASE_URL` | Custom LLM base URL | `https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io` |
| `CUSTOM_LLM_API_KEY` | Custom LLM API key | `eb75c854-3f5b-4ed5-b538-1d67a157243a` |
| `CUSTOM_LLM_PERSONA_ID` | Custom LLM persona ID | `9b94acf5-6fcb-4314-9049-fad8d641206d` |

### 🎙️ Vapi.ai Audio Consultation (NEW)
| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `VITE_VAPI_PUBLIC_KEY` | Vapi.ai public key for audio calls | `pk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |

> ⚠️ **Important**: This must be your Vapi **PUBLIC** key (starts with `pk_`), NOT the secret key (starts with `sk_`). This is used in the frontend build.

---

## 🎯 Quick Action Items

### For Recording Disabled (Default):
Add this secret:
```
TAVUS_ENABLE_RECORDING = false
```

### For Recording Enabled:
1. **Set up AWS** (follow `RECORDING_CONFIGURATION.md`)
2. Add these 4 secrets:
   ```
   TAVUS_ENABLE_RECORDING = true
   TAVUS_RECORDING_S3_BUCKET_NAME = your-bucket-name
   TAVUS_RECORDING_S3_BUCKET_REGION = us-east-1
   TAVUS_AWS_ASSUME_ROLE_ARN = arn:aws:iam::123456789012:role/TavusRecordingRole
   ```

---

## ✅ Verification Checklist

After adding secrets, verify:

- [ ] All 19 secrets are added (or 22 if recording is enabled)
- [ ] No typos in secret names (they're case-sensitive!)
- [ ] `TAVUS_ENABLE_RECORDING` is set (even if `false`)
- [ ] `VITE_VAPI_PUBLIC_KEY` is set with your Vapi public key
- [ ] `JWT_SECRET` is changed from default
- [ ] `DB_CONNECTION_STRING` includes `?sslmode=require` for Azure Postgres

---

## 🚀 Test Deployment

After adding secrets:

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Add recording configuration"
   git push origin main
   ```

2. **Monitor GitHub Actions**:
   - Go to **Actions** tab in GitHub
   - Watch the deployment progress
   - Check for any errors

3. **Verify in Azure**:
   ```bash
   az containerapp logs show \
     --name gene-guide-backend \
     --resource-group rg_custom_llm \
     --follow
   ```

   Look for:
   ```
   TAVUS_ENABLE_RECORDING: False  (or True)
   📹 Recording disabled  (or Recording enabled with S3 bucket: ...)
   ```

---

## 🆘 Troubleshooting

### Secret Not Found Error
```
Error: secrets.TAVUS_ENABLE_RECORDING not found
```
**Solution**: Add the missing secret in GitHub Settings → Secrets

### Wrong Secret Value
```
TAVUS_ENABLE_RECORDING: NOT SET
```
**Solution**: Check the secret name matches exactly (case-sensitive)

### Recording Not Working
```
📹 Recording disabled
```
Even though you set `TAVUS_ENABLE_RECORDING=true`:
- **Solution**: Wait 2-3 minutes for Azure Container App to restart with new env vars
- Check logs: `az containerapp logs show --name gene-guide-backend -g rg_custom_llm --follow`

---

## 📚 Related Documentation

- `RECORDING_CONFIGURATION.md` - AWS S3 setup guide
- `RECORDING_IMPLEMENTATION_SUMMARY.md` - What was changed
- `env.example` - Local development template
- `.github/workflows/deploy.yml` - Deployment workflow

---

## 🔒 Security Notes

⚠️ **Never commit secrets to Git!**
- All secrets stay in GitHub Settings
- They're injected during deployment
- Backend logs show "SET" instead of actual values

✅ **Best practices:**
- Rotate `JWT_SECRET` every 90 days
- Use strong, random keys (not "password123")
- Enable S3 encryption if using recording
- Set up S3 lifecycle policies to auto-delete old recordings

---

## Summary

**Minimum Required (19 secrets):**
- 3 Azure auth secrets
- 2 ACR secrets
- 3 Tavus secrets
- 1 Recording enable secret (set to `false`)
- 2 Database secrets
- 1 JWT secret
- 3 Custom LLM secrets
- 1 **NEW** Vapi.ai public key (for audio consultations)

**Optional Recording (add 3 more = 22 total):**
- S3 bucket name
- S3 region
- AWS IAM role ARN

**Total: 19 secrets minimum, 22 if recording is enabled**

