# 🎙️ Vapi.ai Audio Consultation Integration Guide

## Overview

This guide documents the Vapi.ai audio calling integration added to the Gene Guide AI application. Users can now choose between video consultations (Tavus) or audio consultations (Vapi) when seeking genetic counseling support.

---

## 📋 What Was Added

### New Files Created

1. **`src/types/vapi.d.ts`**
   - TypeScript declarations for the `@vapi-ai/web` package
   - Defines event types and API methods

2. **`src/components/LegacyVoiceCallPanel.tsx`**
   - Main voice call component using Vapi.ai
   - Handles call state management, event listeners, and UI
   - Features: Start/Stop call, Mute/Unmute, Call timer, Error handling

3. **`src/pages/AudioScreen.tsx`**
   - Full page for audio consultations
   - Includes the voice call panel and helpful tips
   - Route: `/audio`

4. **`src/pages/ConsultationTypeScreen.tsx`**
   - Selection screen for choosing between Video or Audio consultation
   - Route: `/consultation-type`

### Modified Files

1. **`package.json`**
   - Added dependency: `"@vapi-ai/web": "^2.5.2"`

2. **`src/App.tsx`**
   - Added routes for `/consultation-type` and `/audio`
   - Imported new screen components

3. **`src/pages/ConditionScreen.tsx`**
   - Updated "Ask Questions & Get Support" button to navigate to `/consultation-type` instead of directly to `/qa`

4. **`env.example`**
   - Added `VITE_VAPI_PUBLIC_KEY` configuration variable

5. **`Dockerfile.frontend`**
   - Added `ARG VITE_VAPI_PUBLIC_KEY` build argument
   - Added `ENV VITE_VAPI_PUBLIC_KEY=${VITE_VAPI_PUBLIC_KEY}` environment variable

6. **`docker-compose.yml`**
   - Added `VITE_VAPI_PUBLIC_KEY=${VITE_VAPI_PUBLIC_KEY}` to frontend build args

---

## 🔧 Configuration Required

### 1. Local Development (.env file)

Add these variables to your `.env` file:

```bash
# Vapi.ai Configuration
VITE_VAPI_PUBLIC_KEY=pk_your_actual_vapi_public_key_here
```

**Where to get the key:**
- Login to https://vapi.ai
- Navigate to Settings → API Keys
- Copy your **Public Key** (starts with `pk_`)

### 2. Assistant ID Configuration

Edit `src/components/LegacyVoiceCallPanel.tsx` (line 13):

```typescript
// Replace this:
const ASSISTANT_ID = "REPLACE_ME_WITH_ASSISTANT_ID";

// With your actual Vapi Assistant ID:
const ASSISTANT_ID = "your-actual-assistant-id-uuid";
```

**Where to get the Assistant ID:**
- In Vapi dashboard, go to **Assistants**
- Create or select an assistant
- Copy the Assistant ID (UUID format)

### 3. GitHub Actions (CI/CD)

If you have GitHub Actions workflows for deployment, add this secret:

**Secret Name:** `VAPI_PUBLIC_KEY`  
**Secret Value:** Your Vapi public key (starts with `pk_`)

**How to add:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `VAPI_PUBLIC_KEY`
4. Value: Your actual Vapi public key

**Update your workflow to pass the build arg:**

```yaml
- name: Build and push frontend image
  run: |
    docker build \
      --file Dockerfile.frontend \
      --build-arg VITE_TAVUS_BACKEND_URL=${{ secrets.VITE_TAVUS_BACKEND_URL }} \
      --build-arg VITE_VAPI_PUBLIC_KEY=${{ secrets.VAPI_PUBLIC_KEY }} \
      ...
```

---

## 🚀 Installation & Setup

### Step 1: Install Dependencies

```bash
npm install
```

This installs the `@vapi-ai/web` package.

### Step 2: Configure Environment

Add `VITE_VAPI_PUBLIC_KEY` to your `.env` file (see Configuration section above).

### Step 3: Update Assistant ID

Edit `src/components/LegacyVoiceCallPanel.tsx` and replace the placeholder Assistant ID.

### Step 4: Build & Run

**Local Development:**
```bash
npm run dev
```

**Docker:**
```bash
docker-compose up -d --build
```

### Step 5: Test

Navigate to:
- `http://localhost:8090/conditions` → Click "Ask Questions & Get Support"
- Choose "Audio Consultation"
- Click "Start Call" to test Vapi integration

---

## 🎯 User Flow

1. **Conditions Screen** (`/conditions`)
   - User views their genetic test results
   - Clicks "Ask Questions & Get Support" button

2. **Consultation Type Selection** (`/consultation-type`)
   - User chooses between:
     - **Video Consultation** → Goes to `/qa` (Tavus video)
     - **Audio Consultation** → Goes to `/audio` (Vapi audio)

3. **Audio Consultation** (`/audio`)
   - User sees the voice call panel
   - Clicks "Start Call" to begin Vapi audio conversation
   - Can mute/unmute during call
   - Clicks "End Call" to finish

---

## 🔒 Security Notes

### ✅ CORRECT: Public Key in Frontend

```bash
# .env file
VITE_VAPI_PUBLIC_KEY=pk_1234567890abcdef...
```

- Public keys (starting with `pk_`) are **safe** to use in frontend
- They are baked into the build at compile time
- This is the intended Vapi.ai architecture

### ❌ NEVER: Secret Key in Frontend

```bash
# NEVER DO THIS!
VITE_VAPI_SECRET_KEY=sk_1234567890abcdef...
```

- Secret keys (starting with `sk_`) must **NEVER** be in frontend code
- They should only be used in backend servers
- Frontend uses public keys + Assistant IDs only

---

## 🧪 Testing Checklist

- [ ] `npm install` completes successfully
- [ ] `VITE_VAPI_PUBLIC_KEY` added to `.env`
- [ ] `ASSISTANT_ID` updated in `LegacyVoiceCallPanel.tsx`
- [ ] App runs without TypeScript errors
- [ ] Can navigate to `/consultation-type`
- [ ] Can see both Video and Audio options
- [ ] Clicking "Start Audio Consultation" goes to `/audio`
- [ ] Audio page loads without errors
- [ ] No config warning appears (if keys are set)
- [ ] "Start Call" button is enabled
- [ ] Can start a Vapi call successfully
- [ ] Can mute/unmute during call
- [ ] Can end call successfully
- [ ] Call timer displays correctly

---

## 🐛 Troubleshooting

### Issue: "Configuration Required" warning

**Cause:** Missing `VITE_VAPI_PUBLIC_KEY` or invalid `ASSISTANT_ID`

**Solution:**
1. Check `.env` file has `VITE_VAPI_PUBLIC_KEY=pk_...`
2. Check `LegacyVoiceCallPanel.tsx` has valid Assistant ID
3. Restart dev server after changing `.env`

### Issue: "Failed to start call"

**Cause:** Invalid credentials or network issue

**Solution:**
1. Verify public key is correct and starts with `pk_`
2. Verify Assistant ID is a valid UUID from Vapi dashboard
3. Check browser console (F12) for detailed error messages
4. Ensure microphone permissions are granted

### Issue: TypeScript errors for Vapi

**Cause:** Type declarations not loaded

**Solution:**
1. Check `src/types/vapi.d.ts` exists
2. Restart TypeScript server in your IDE
3. Run `npm install` again

### Issue: Build fails in Docker

**Cause:** Missing build arg for `VITE_VAPI_PUBLIC_KEY`

**Solution:**
1. Ensure `.env` file has `VITE_VAPI_PUBLIC_KEY`
2. Check `docker-compose.yml` passes the build arg
3. Rebuild: `docker-compose up -d --build`

---

## 📚 Related Documentation

- **Vapi.ai Docs:** https://docs.vapi.ai
- **Vapi Web SDK:** https://github.com/VapiAI/web
- **Project README:** `README.md`
- **Tavus Integration:** `TAVUS_INTEGRATION_GUIDE.md`
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md`

---

## 🎉 Summary

**Files Changed:** 9  
**Files Created:** 4  
**New Routes:** 2 (`/consultation-type`, `/audio`)  
**New Dependencies:** 1 (`@vapi-ai/web`)

The integration is complete and ready for use once you configure:
1. `VITE_VAPI_PUBLIC_KEY` in `.env`
2. `ASSISTANT_ID` in `LegacyVoiceCallPanel.tsx`
3. Run `npm install` and start the app

Users can now choose between video (Tavus) or audio (Vapi) consultations seamlessly!

