# 🧪 Testing Guide: Custom LLM Integration

## Quick Test Checklist

### ✅ Phase 1: Backend Health Check

**Test database connectivity:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8086/persona-test-types" -Method GET | Select-Object -ExpandProperty Content
```

**Expected:** JSON array of persona test types

**Test classification types:**
```powershell
Invoke-WebRequest -Uri "http://localhost:8086/classification-types" -Method GET | Select-Object -ExpandProperty Content
```

**Expected:** JSON array of classification types

---

### ✅ Phase 2: Frontend Application Flow

**1. Login**
- URL: `http://localhost:8090`
- Use existing credentials
- **Check browser console:** Look for `[login] userId: <uuid>`
- **Expected:** Redirect to introduction screen

**2. Save Genetic Information**
- URL: `http://localhost:8090/introduction`
- Fill in the form:
  - Who is this test for? → `Myself`
  - Gene: `BRCA1`
  - Mutation: `c.5266dupC`
  - Classification: `Variant of Unknown Significance`
- Click **Save** button
- **Expected:** Green success banner appears

**Browser Console Logs:**
```
[intro] Saving genetic information...
[intro] userId from localStorage: <uuid>
[intro] Payload: {userId: "...", personaTestTypeId: 1, ...}
[intro] Save successful
```

**Backend Logs:**
```
[INFO] request POST /base-information
[INFO] save_base_information:request user_id=<uuid> gene=BRCA1
[INFO] ✅ base_information:inserted user_id=<uuid> gene=BRCA1
```

**3. View Condition Analysis**
- URL: `http://localhost:8090/condition`
- **Expected:** Loading spinner appears

**Browser Console Logs:**
```
[condition] Checking authentication...
[condition] userId from localStorage: <uuid>
[condition] Fetching analysis for userId: <uuid>
[condition] Response status: 200
[condition] Analysis received: {condition: "...", riskLevel: "...", ...}
```

**Backend Logs:**
```
[INFO] request GET /condition-analysis/<uuid>
[INFO] 🔬 condition_analysis:request user_id=<uuid>
[INFO] 📊 Retrieved: gene=BRCA1, mutation=c.5266dupC, classification=VUS
[INFO] 🤖 Calling custom LLM for condition analysis...
[INFO] 🤖 custom_llm:call conversation_id=<random-uuid>
[INFO] 🤖 custom_llm:prompt_length=XXX chars
[INFO] ✅ custom_llm:response_length=XXX chars
[INFO] ✅ condition_analysis:success condition=<condition-name>
```

---

### ✅ Phase 3: Verify Custom LLM Integration

**Check environment variables are loaded:**
```powershell
docker compose logs backend | Select-String "CUSTOM_LLM"
```

**Expected output:**
```
CUSTOM_LLM_BASE_URL: https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io
CUSTOM_LLM_API_KEY: SET
CUSTOM_LLM_PERSONA_ID: 9b94acf5-6fcb-4314-9049-fad8d641206d
```

**If you see "NOT SET":**
1. Check your `.env` file has the custom LLM variables
2. Run `docker compose down`
3. Run `docker compose up -d --build`

---

### ✅ Phase 4: Test Custom LLM Directly (Optional)

**Using the test script:**
```powershell
python test_custom_llm.py
```

**Expected output:**
```
[AI] Testing Custom LLM API...
URL: https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io/v1/chat/completions
Status Code: 200

[SUCCESS] Response received!
Response:
<AI-generated content about BRCA1>
```

**If timeout occurs:**
- Azure Container Apps may be cold-starting (wait 30-60 seconds and retry)
- Try testing through the web UI instead

---

## 🐛 Troubleshooting

### Issue: "No userId found - redirecting to login"

**Solution:**
1. Login at `http://localhost:8090`
2. Check browser console for `userId` in localStorage
3. Don't navigate directly to `/condition` without logging in first

---

### Issue: "Please complete the introductory screen first"

**Solution:**
1. Go to `/introduction`
2. Fill in ALL fields (gene, mutation, classification)
3. Click **Save**
4. Then navigate to `/condition`

---

### Issue: "The AI returned an invalid format"

**Cause:** Custom LLM returned non-JSON or malformed JSON

**Solution:**
1. Check backend logs for `Raw response (first 500 chars)`
2. The AI might need better prompt tuning
3. Try again - sometimes LLMs have inconsistent outputs

---

### Issue: Backend logs show "CUSTOM_LLM_BASE_URL: NOT SET"

**Solution:**
1. Edit your `.env` file (NOT `env.example`)
2. Add the custom LLM variables:
   ```env
   CUSTOM_LLM_BASE_URL=https://custom-llm-gc.ashydune-c5455a7b.centralus.azurecontainerapps.io
   CUSTOM_LLM_API_KEY=eb75c854-3f5b-4ed5-b538-1d67a157243a
   CUSTOM_LLM_PERSONA_ID=9b94acf5-6fcb-4314-9049-fad8d641206d
   ```
3. Restart: `docker compose down && docker compose up -d --build`

---

### Issue: Custom LLM timeout after 30+ seconds

**Possible causes:**
- Azure Container App is cold (first request takes 30-60s)
- Service is down
- Network issue

**Solution:**
1. Wait 60 seconds and try again
2. Test directly: `python test_custom_llm.py`
3. Check Azure Container Apps dashboard for service health
4. Increase timeout in `app.py` if needed (currently 60s)

---

## 📊 What to Look For

### Successful Flow:

**Frontend (Browser Console):**
```
[login] Authenticated user: <email>
[intro] Save successful
[condition] Analysis received: {condition: "...", ...}
```

**Backend (Docker Logs):**
```
[INFO] auth:login:success email=<email>
[INFO] ✅ base_information:inserted user_id=<uuid>
[INFO] 🤖 custom_llm:call conversation_id=<uuid>
[INFO] ✅ custom_llm:response_length=XXX chars
[INFO] ✅ condition_analysis:success condition=<name>
```

**Condition Screen Display:**
- Condition name (e.g., "Hereditary Breast and Ovarian Cancer Syndrome")
- Risk level badge (High/Moderate/Low)
- Gene: BRCA1
- Variant: c.5266dupC
- Classification: VUS
- 4 implications
- 4 recommendations
- 4 resources

---

## 🔍 Monitoring Commands

**Watch backend logs in real-time:**
```powershell
docker compose logs backend -f
```

**Search for specific log entries:**
```powershell
# Check custom LLM calls
docker compose logs backend | Select-String "custom_llm"

# Check condition analysis
docker compose logs backend | Select-String "condition_analysis"

# Check database operations
docker compose logs backend | Select-String "base_information"
```

**Check container status:**
```powershell
docker compose ps
```

**Restart everything fresh:**
```powershell
docker compose down
docker compose up -d --build
docker compose logs backend -f
```

---

## ✅ Success Criteria

You'll know it's working when:

1. ✅ Login redirects to `/introduction`
2. ✅ Saving genetic info shows green success banner
3. ✅ Backend logs show database insert
4. ✅ Navigate to `/condition` shows loading spinner
5. ✅ Backend logs show custom LLM call
6. ✅ Condition screen displays AI-generated analysis
7. ✅ Gene, mutation, and classification are displayed correctly

---

## 🚀 Next Steps After Testing

Once everything works:

1. **Test with different genes:**
   - Try: BRCA2, TP53, MLH1, MSH2, etc.
   - Verify AI generates appropriate content for each

2. **Test different classifications:**
   - Pathogenic → Should show "High" risk
   - VUS → Should show "Moderate" risk
   - Benign → Should show "Low" risk

3. **Test edge cases:**
   - Missing gene/mutation (should show error)
   - Invalid user ID (should redirect to login)
   - Multiple saves (should update, not duplicate)

4. **Performance testing:**
   - Time the LLM response
   - Check if responses are cached
   - Monitor token usage

Good luck! 🎉

