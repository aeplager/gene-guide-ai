# 🔧 Vapi Authentication Error - Fix Instructions

## ❌ Current Error
```
POST https://api.vapi.ai/call/web 401 (Unauthorized)
```

This means your Vapi public key is **invalid or incorrect**.

## 🔍 Diagnosis

Your current `.env` file has:
```bash
VITE_VAPI_PUBLIC_KEY=pk_38237249-6af0-4b17-9b24-5dd85cc225b7
```

**This format looks like an Assistant ID (UUID), not a Public Key!**

### ✅ Correct Formats:
- **Assistant ID**: `b0ff3584-411d-4ebf-aae5-30329765476f` (UUID format - you have this correct!)
- **Public Key**: Should be a long alphanumeric string like `pk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## 📝 How to Fix

### Step 1: Get Your Real Vapi Public Key

1. Log into **Vapi Dashboard**: https://dashboard.vapi.ai
2. Navigate to **"API Keys"** or **"Settings"** section
3. Look for your **Public Key** (starts with `pk_`)
4. Copy the entire key (it should be a long string, NOT a UUID)

### Step 2: Update Your `.env` File

Open your `.env` file and replace the current line with your actual public key:

```bash
# WRONG (current - UUID format)
# VITE_VAPI_PUBLIC_KEY=pk_38237249-6af0-4b17-9b24-5dd85cc225b7

# CORRECT (should be long alphanumeric string)
VITE_VAPI_PUBLIC_KEY=pk_your_actual_long_public_key_here
```

### Step 3: Rebuild Docker Containers

After updating your `.env` file, run these commands:

```bash
# Stop containers
docker-compose down

# Rebuild web container without cache
docker-compose build --no-cache web

# Start containers
docker-compose up -d
```

### Step 4: Test Again

1. Open browser to `http://localhost:8090`
2. Navigate to: Conditions → Ask Questions & Get Support → Start Audio Consultation
3. Click "Start Call"
4. Check browser DevTools Console (F12) for errors

## 🆘 Still Having Issues?

If you still get errors after fixing the public key:

1. **Verify your public key is active** in Vapi dashboard
2. **Check if your Vapi account has credits/active subscription**
3. **Verify the Assistant ID** is correct and active
4. **Share the new error messages** from browser DevTools Console

## 📚 Key Differences

| Item | Format | Where to Use |
|------|--------|--------------|
| **Public Key** | `pk_xxxxxxxxxxxxx...` (long string) | `.env` file as `VITE_VAPI_PUBLIC_KEY` |
| **Secret Key** | `sk_xxxxxxxxxxxxx...` (long string) | **NEVER in frontend!** Backend only |
| **Assistant ID** | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (UUID) | Code: `LegacyVoiceCallPanel.tsx` line 13 |

## ✅ Checklist

- [ ] Logged into Vapi Dashboard
- [ ] Found the correct Public Key (long alphanumeric string)
- [ ] Updated `.env` file with real public key
- [ ] Ran `docker-compose down`
- [ ] Ran `docker-compose build --no-cache web`
- [ ] Ran `docker-compose up -d`
- [ ] Tested the audio consultation feature
- [ ] Verified no 401 errors in browser console

