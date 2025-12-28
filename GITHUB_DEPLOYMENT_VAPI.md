# 🚀 GitHub Actions Deployment - Vapi.ai Integration

## ✅ What Was Updated

1. ✅ **GITHUB_SECRETS_CHECKLIST.md** - Added `VITE_VAPI_PUBLIC_KEY` to the secrets list
2. ✅ **.github/workflows/deploy.yml** - Added Vapi public key to frontend build args

---

## 🔑 New Secret Required

You need to add **ONE new GitHub Actions secret**:

### Secret Name: `VITE_VAPI_PUBLIC_KEY`

**Value:** Your Vapi.ai public key (the long alphanumeric string, NOT the UUID format)

**Example:**
```
pk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

## 📝 How to Add the Secret

1. **Go to your GitHub repository**

2. **Navigate to Settings → Secrets and variables → Actions**

3. **Click "New repository secret"**

4. **Add the secret:**
   - **Name:** `VITE_VAPI_PUBLIC_KEY`
   - **Value:** Your actual Vapi public key from https://dashboard.vapi.ai

5. **Click "Add secret"**

---

## 🔍 Where to Get Your Vapi Public Key

1. Go to **https://dashboard.vapi.ai**
2. Login to your Vapi account
3. Navigate to **"API Keys"** or **"Settings"**
4. Find your **Public Key** (starts with `pk_`)
5. Copy the entire key (it's a long alphanumeric string)

⚠️ **Important:** 
- Use the **PUBLIC** key (starts with `pk_`)
- Do NOT use the SECRET key (starts with `sk_`)
- The key should be a long string, NOT a UUID format like `pk_12345678-1234-1234-1234-123456789012`

---

## 📊 Updated Secrets Count

**Before Vapi Integration:** 18 secrets (or 21 with recording)
**After Vapi Integration:** 19 secrets (or 22 with recording)

### Complete Secrets List (19 total):

1. **Azure Auth (3):**
   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`

2. **Azure Container Registry (2):**
   - `ACR_USERNAME`
   - `ACR_PASSWORD`

3. **Tavus (3):**
   - `TAVUS_API_KEY`
   - `TAVUS_REPLICA_ID`
   - `TAVUS_PERSONA_ID`

4. **Recording (1 required + 3 optional):**
   - `TAVUS_ENABLE_RECORDING` (required - set to `true` or `false`)
   - `TAVUS_RECORDING_S3_BUCKET_NAME` (optional)
   - `TAVUS_RECORDING_S3_BUCKET_REGION` (optional)
   - `TAVUS_AWS_ASSUME_ROLE_ARN` (optional)

5. **Database (2):**
   - `DB_CONNECTION_STRING`
   - `COMPANY_ID`

6. **Authentication (1):**
   - `JWT_SECRET`

7. **Custom LLM (3):**
   - `CUSTOM_LLM_BASE_URL`
   - `CUSTOM_LLM_API_KEY`
   - `CUSTOM_LLM_PERSONA_ID`

8. **🆕 Vapi.ai Audio (1):**
   - `VITE_VAPI_PUBLIC_KEY`

---

## 🚀 Deployment Process

Once you add the secret:

1. **Commit and push your code:**
   ```bash
   git add .
   git commit -m "Add Vapi.ai audio consultation feature"
   git push origin main
   ```

2. **GitHub Actions will automatically:**
   - Build the backend Docker image
   - Build the frontend Docker image **with VITE_VAPI_PUBLIC_KEY baked in**
   - Deploy both to Azure Container Apps

3. **Monitor the deployment:**
   - Go to **Actions** tab in GitHub
   - Watch the deployment progress
   - Check for any errors

---

## ✅ Verification

After deployment completes:

1. **Visit your frontend URL** (shown in GitHub Actions logs)

2. **Navigate through the app:**
   - Login
   - Go to Conditions screen
   - Click "Ask Questions & Get Support"
   - You should see **both Video and Audio options**

3. **Test Audio Consultation:**
   - Click "Start Audio Consultation"
   - Click "Start Call"
   - Should connect to Vapi voice assistant

4. **Check browser console** (F12) - should see:
   ```
   [Vapi] Instance created successfully
   [Vapi] Starting call with assistant: ...
   ```

---

## ❌ Common Issues

### Issue: 401 Unauthorized Error
```
POST https://api.vapi.ai/call/web 401 (Unauthorized)
```

**Cause:** Invalid or missing Vapi public key

**Solution:**
1. Verify the secret name is exactly `VITE_VAPI_PUBLIC_KEY` (case-sensitive)
2. Check the key format (should be long alphanumeric, not UUID)
3. Verify the key is active in Vapi dashboard
4. Rebuild: `docker-compose build --no-cache web`

### Issue: Secret Not Found
```
Error: secrets.VITE_VAPI_PUBLIC_KEY not found
```

**Solution:** Add the secret in GitHub Settings → Secrets and variables → Actions

### Issue: Audio Page Not Found
**Solution:** Clear browser cache or do a hard refresh (Ctrl+F5)

---

## 📚 Related Documentation

- **VAPI_INTEGRATION_GUIDE.md** - Complete Vapi integration documentation
- **VAPI_DEBUG_INSTRUCTIONS.md** - Troubleshooting 401 errors
- **GITHUB_SECRETS_CHECKLIST.md** - Complete list of all secrets
- **DEPLOYMENT_GUIDE.md** - Azure deployment guide

---

## 🔒 Security Notes

✅ **Safe to use in frontend:**
- `VITE_VAPI_PUBLIC_KEY` is designed to be public
- It's baked into the frontend build (not a secret)
- Starts with `pk_` (public key prefix)

❌ **NEVER use in frontend:**
- Vapi Secret Key (starts with `sk_`)
- Backend API keys
- Database credentials

---

## 📞 Support

If you run into issues:

1. Check the **browser console** (F12) for error messages
2. Review **GitHub Actions logs** for build errors
3. Verify **all 19 secrets** are added correctly
4. Check **Vapi dashboard** for account status

---

## ✨ Summary

**To deploy with Vapi integration:**

1. ✅ Add `VITE_VAPI_PUBLIC_KEY` to GitHub Secrets (with your actual Vapi public key)
2. ✅ Push your code to `main` branch
3. ✅ GitHub Actions will automatically deploy
4. ✅ Test the audio consultation feature in production

**Total secrets needed: 19 (or 22 with recording enabled)**

🎉 **You're all set!**

