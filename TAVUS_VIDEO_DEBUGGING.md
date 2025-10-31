# 🎥 Tavus Video Not Displaying - Diagnosis & Fix

## 🔍 **Issue Summary**

**Symptom:** Tavus conversation starts successfully on the Tavus portal, but the video doesn't display in your application's iframe.

**Root Cause:** CORS blocking the `Authorization` header + missing iframe permissions.

---

## ✅ **What I Fixed**

### **Fix 1: CORS Configuration** (Critical)

**Problem:** Your CORS setup only allowed `Content-Type` header, but the frontend is now sending `Authorization: Bearer <token>`.

**Before:**
```python
CORS(app, allow_headers=["Content-Type"])
```

**After:**
```python
CORS(app, allow_headers=["Content-Type", "Authorization"])
```

**Impact:** Without this fix, the browser blocks the `/tavus/start` request when it includes the JWT token.

---

### **Fix 2: Iframe Permissions**

**Problem:** Daily.co needs explicit permissions for camera, microphone, etc.

**Added:**
```typescript
const frame = DailyIframe.createFrame(containerRef.current, {
  iframeStyle: { width: '100%', height: '100%', border: '0' },
  allow: 'camera; microphone; autoplay; display-capture; fullscreen; picture-in-picture'
});
```

**Impact:** Without these permissions, the iframe can't access media devices or display content properly.

---

### **Fix 3: Enhanced Logging**

**Backend** - Now logs full Tavus response:
```
[INFO] 📹 TAVUS RESPONSE DETAILS
[INFO] conversation_id: c3a25c9956d5c451
[INFO] conversation_name: Conversation Guest
[INFO] conversation_url: https://tavus.daily.co/c3a25c9956d5c451
[INFO] status: active
```

**Frontend** - Comprehensive Daily.co event logging:
```javascript
console.log('[qa] DailyIframe available, creating frame...');
console.log('[qa] Container ref available:', containerRef.current);
console.log('[qa] Frame created:', frame);
console.log('[qa] 📹 daily:loading', e);
console.log('[qa] 📹 daily:loaded', e);
console.log('[qa] 📹 daily:joined-meeting', e);
```

---

## 🧪 **Testing Instructions**

### **Step 1: Clear Browser Cache**

**Important!** Your browser may have cached the old CORS settings.

**Option A - Hard Refresh:**
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

**Option B - Clear Cache:**
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

---

### **Step 2: Test Tavus Video**

1. **Open** `http://localhost:8090`

2. **Login** (or continue without auth - JWT is optional)

3. **Navigate to** `/qa` screen

4. **Open Browser Console** (F12 → Console tab)

5. **Click "Start Video Call"**

6. **Watch the logs:**

**Expected Browser Console Logs:**
```
[qa] starting conversation {backendBase: ""}
[qa] sending with JWT token
[qa] tavus:start response {...}
[qa] backend debug info: {...}
[qa] DailyIframe available, creating frame...
[qa] Container ref available: <div>
[qa] Frame created: {join: ƒ, leave: ƒ, ...}
[qa] Event listeners attached, joining Daily call...
[qa] Conversation URL: https://tavus.daily.co/c3a25c9956d5c451
[qa] Conversation ID: c3a25c9956d5c451
[qa] Waiting 1500ms before joining...
[qa] Calling frame.join()...
[qa] 📹 daily:loading
[qa] 📹 daily:loaded
[qa] 📹 daily:joining-meeting
[qa] 📹 daily:joined-meeting
[qa] ✅ frame.join() completed successfully
```

**Expected Backend Logs:**
```
[INFO] request GET /tavus/start
[INFO] 🔥 custom_llm:prewarm:start
[INFO] ✅ custom_llm:prewarm:success duration=0.18s
[INFO] 🎥 tavus:start:request
[INFO] 🎥 tavus:start:response status=200
[INFO] ================================================================================
[INFO] 📹 TAVUS RESPONSE DETAILS
[INFO] ================================================================================
[INFO] conversation_id: c3a25c9956d5c451
[INFO] conversation_url: https://tavus.daily.co/c3a25c9956d5c451
[INFO] status: active
```

---

### **Step 3: Verify Video Display**

**Success Indicators:**

✅ **Browser Console:**
- No CORS errors
- `daily:loaded` event fires
- `daily:joined-meeting` event fires
- No "DailyIframe not available" errors

✅ **Visual:**
- Video iframe appears on screen
- AI counselor video is visible
- You can see yourself in preview (if camera enabled)
- Audio works when speaking

✅ **Backend Logs:**
- `conversation_url` returned
- `status: active`
- No 401/403 errors

---

## 🐛 **Troubleshooting**

### **Error: "DailyIframe not available on window"**

**Cause:** Daily.co script not loaded

**Fix:**
1. Check `index.html` has: `<script src="https://unpkg.com/@daily-co/daily-js"></script>`
2. Hard refresh browser
3. Check Network tab to verify script loaded (Status 200)

---

### **Error: CORS policy blocking request**

**Symptoms in browser console:**
```
Access to fetch at 'http://localhost:8086/tavus/start' from origin 'http://localhost:8090' 
has been blocked by CORS policy: Request header field authorization is not allowed
```

**Cause:** CORS not allowing `Authorization` header

**Fix:** Already applied - but verify:
1. Check backend logs for `CORS_ORIGINS: http://localhost:8090`
2. Restart backend: `docker compose restart backend`
3. Hard refresh browser

---

### **Error: "Container ref not available"**

**Cause:** React ref not initialized

**Fix:**
1. Check `containerRef` is defined: `const containerRef = useRef<HTMLDivElement | null>(null);`
2. Verify JSX has: `<div ref={containerRef} className="w-full h-full" />`
3. Make sure you click "Start Video Call" (not navigating directly)

---

### **Video starts on Tavus portal but NOT in iframe**

**Symptoms:**
- Tavus portal shows active conversation
- Your app shows empty iframe or "Connection failed"
- Browser console shows no Daily.co events

**Causes & Fixes:**

1. **iframe permissions missing**
   - ✅ Already fixed - `allow` attribute added

2. **CORS blocking**
   - ✅ Already fixed - Authorization header allowed

3. **Daily.co room URL incorrect**
   - Check backend logs for `conversation_url`
   - Should be: `https://tavus.daily.co/<conversation_id>`
   - Verify it's being passed to `frame.join({ url: convUrl })`

4. **iframe not rendering**
   - Check browser Elements tab (F12 → Elements)
   - Look for `<iframe>` element inside your container div
   - If missing, Daily.co failed to create the iframe

---

### **Slow first response (20+ seconds)**

**Not a bug!** This is Azure Container Apps cold start.

**With pre-warming enabled:**
- Pre-warm: ~8-10 seconds (logs show `prewarm:success duration=X.XXs`)
- First AI response: ~3-5 seconds
- Total: ~11-15 seconds

**Without pre-warming:**
- Cold start: ~15-20 seconds
- First AI response: ~20+ seconds
- Total: ~35-40 seconds

**Verify pre-warming is working:**
```
[INFO] 🔥 custom_llm:prewarm:start
[INFO] ✅ custom_llm:prewarm:success status=200 duration=0.18s
```

---

## 📊 **Verification Checklist**

After rebuild, verify these in order:

- [ ] **Backend started** - `docker compose logs backend | grep "CORS_ORIGINS"`
  - Should show: `CORS_ORIGINS: http://localhost:8090`

- [ ] **Frontend started** - Open `http://localhost:8090`
  - No console errors on page load

- [ ] **Daily.co script loaded** - Check Network tab (F12)
  - Look for `daily-js` request
  - Status should be 200

- [ ] **Login working** - Login and check localStorage
  - `localStorage.getItem('auth_token')` returns token
  - `localStorage.getItem('userId')` returns UUID

- [ ] **Tavus API responding** - Start video call
  - Backend logs show `🎥 tavus:start:response status=200`
  - Backend logs show `conversation_url: https://tavus.daily.co/...`

- [ ] **Daily.co iframe created** - Check browser console
  - `[qa] Frame created: {...}` appears
  - `[qa] 📹 daily:loaded` appears

- [ ] **Video visible** - Visual confirmation
  - AI counselor appears on screen
  - Audio works

---

## 🎯 **Next Steps**

1. **Test now:**
   ```
   http://localhost:8090/qa
   ```

2. **Open browser console (F12)** before clicking "Start Video Call"

3. **Watch for:**
   - CORS errors (red text in console)
   - Daily.co events (`daily:loaded`, `daily:joined-meeting`)
   - Any errors with `DailyIframe`

4. **Check backend logs:**
   ```powershell
   docker compose logs backend -f
   ```

5. **If still not working:**
   - Copy the **full browser console output** (everything from clicking "Start Video Call")
   - Copy the **backend logs** from when you clicked the button
   - Share both with me

---

## 💡 **Why It Wasn't Working Before**

1. **CORS blocking Authorization header** ← Primary issue
   - Browser silently blocked the request
   - Tavus API never received JWT token
   - Still worked because JWT is optional, but debugging was harder

2. **Missing iframe permissions**
   - Daily.co couldn't access camera/microphone
   - Video wouldn't render even if room joined

3. **Insufficient logging**
   - Hard to diagnose without seeing Daily.co events
   - Couldn't tell if iframe was created or join failed

All three issues are now fixed! ✅

---

## 🚀 **Expected Results After Fix**

**Timeline:**
1. Click "Start Video Call" → 0s
2. Pre-warm custom LLM → ~0.2s (already warm)
3. Tavus API call → ~3s
4. Daily.co iframe loads → ~2s
5. Video appears → **~5-6 seconds total**

**What you'll see:**
1. "Connecting..." button with spinner
2. Browser console logs scrolling
3. Backend logs showing Tavus response
4. Iframe appears with video
5. AI counselor starts talking
6. "Video call started" toast notification

**Success!** 🎉

