# 🚀 Condition Analysis Caching System

## Problem Solved

The `/conditions` screen was taking **5-10 seconds** to load because it called the custom LLM to generate analysis on **every page visit**.

## Solution Implemented

### ✅ **Smart Caching System**

**First Visit (Slow - once per user):**
1. User visits `/conditions` screen
2. Backend calls LLM (~5-10 seconds)
3. **Saves analysis to database**
4. Returns results

**Subsequent Visits (Fast - cached):**
1. User visits `/conditions` screen
2. Backend checks cache (**~100ms**)
3. Returns cached results
4. **No LLM call needed!** 🎉

---

## Performance Comparison

| Scenario | Before | After |
|----------|--------|-------|
| First visit | 5-10s | 5-10s (generates cache) |
| Repeat visits | 5-10s | **~100ms** ⚡ |
| **Improvement** | N/A | **50-100x faster!** |

---

## Cache Details

### **Cache Duration:**
- **7 days** - Analysis stays valid for a week
- After 7 days: Regenerates automatically
- Fresh data ensured, but fast repeat access

### **Cache Storage:**
- Stored in: `GenCom.BaseInformation` table
- Columns:
  - `CachedAnalysis` (TEXT) - JSON analysis data
  - `AnalysisCachedAt` (TIMESTAMP) - When it was cached

### **Cache Invalidation:**
- Automatic after 7 days
- Manual: Update gene/mutation → new analysis generated

---

## Database Migration Required

### **Run This SQL:**

```bash
# Connect to your PostgreSQL database
psql <your-connection-string>

# Run the migration
\i database_migration_add_cache.sql
```

**Or run directly:**
```sql
ALTER TABLE "GenCom"."BaseInformation" 
ADD COLUMN "CachedAnalysis" TEXT NULL;

ALTER TABLE "GenCom"."BaseInformation" 
ADD COLUMN "AnalysisCachedAt" TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX idx_base_information_cached_at 
ON "GenCom"."BaseInformation"("AnalysisCachedAt") 
WHERE "CachedAnalysis" IS NOT NULL;
```

---

## Logs to Expect

### **Cache Hit (Fast Path):**
```
[condition] 📊 Retrieved: gene=BRCA1, mutation=c.185delAG, classification=Pathogenic
[condition] 📦 Found cached analysis (age: 2 days)
[condition] ✅ Returning cached analysis (fast path)
```

### **Cache Miss (Slow Path - First Time):**
```
[condition] 📊 Retrieved: gene=BRCA1, mutation=c.185delAG, classification=Pathogenic
[condition] 🤖 Calling custom LLM for condition analysis...
[condition] ✅ Custom LLM response received: 1238 chars
[condition] 💾 Analysis cached to database for faster future access
[condition] ✅ condition_analysis:success condition=Hereditary Breast Cancer
```

---

## Testing

### **Test Cache Hit:**
```bash
# 1. Visit /conditions (first time - slow)
curl https://gene-guide-frontend.azurecontainerapps.io/conditions

# 2. Visit /conditions (second time - fast!)
curl https://gene-guide-frontend.azurecontainerapps.io/conditions
```

### **Check Backend Logs:**
```bash
az containerapp logs show -g rg_custom_llm -n gene-guide-backend --tail 50
```

Look for:
- `✅ Returning cached analysis (fast path)` ← Cache working!
- `💾 Analysis cached to database` ← New cache created

---

## Benefits

1. ⚡ **50-100x faster** repeat visits
2. 💰 **Reduced LLM API costs** (only call once per user)
3. 🔋 **Lower server load** (no repeated expensive calls)
4. 😊 **Better UX** (instant analysis display)
5. 🌍 **Environmentally friendly** (less compute = less energy)

---

## Advanced: Manual Cache Clear

If you need to force regenerate analysis:

```sql
-- Clear cache for specific user
UPDATE "GenCom"."BaseInformation"
SET "CachedAnalysis" = NULL,
    "AnalysisCachedAt" = NULL
WHERE "UserID" = 'user-uuid-here';

-- Clear all caches (force regenerate for everyone)
UPDATE "GenCom"."BaseInformation"
SET "CachedAnalysis" = NULL,
    "AnalysisCachedAt" = NULL;
```

---

## Configuration

**To change cache duration**, edit `app.py`:

```python
# Change from 7 days to something else
cache_valid = cache_age < timedelta(days=7)  # ← Change this number
```

Options:
- `timedelta(hours=24)` - 24 hours
- `timedelta(days=30)` - 30 days
- `timedelta(weeks=2)` - 2 weeks

