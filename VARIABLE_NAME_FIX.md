# Variable Name Error Fix

## Issue
After the database schema update, there were Python `NameError` exceptions:
```
NameError: name 'cached_analysis_basic' is not defined
```

## Root Cause
When updating the code to use lowercase column names, some dictionary key accesses were incorrectly left as bare variable names instead of string literals:

**Wrong:**
```python
cached_data = json.loads(cached_result[cached_analysis_basic])  # ❌ Python thinks this is a variable
```

**Correct:**
```python
cached_data = json.loads(cached_result["cached_analysis_basic"])  # ✅ String literal
```

## Files Modified

### `app.py`

Fixed 5 instances where variable names were used instead of string literals:

**1. Line 1819 - `/condition-analysis/<user_id>/basic` endpoint**
```python
# Before
cached_data = json.loads(cached_result[cached_analysis_basic])

# After
cached_data = json.loads(cached_result["cached_analysis_basic"])
```

**2. Line 1987 - `/condition-analysis/<user_id>/detailed` endpoint**
```python
# Before
cached_data = json.loads(cached_result[cached_analysis_detailed])

# After
cached_data = json.loads(cached_result["cached_analysis_detailed"])
```

**3. Line 2179 - `/condition/<user_id>` endpoint (legacy)**
```python
# Before
cached_data = json.loads(cached_result[cached_analysis])

# After
cached_data = json.loads(cached_result["cached_analysis"])
```

**4. Line 1422 - `/base-information` POST endpoint**
```python
# Before
classification_name = classification_row[classification_type] if classification_row else "Unknown"

# After
classification_name = classification_row["classification_type"] if classification_row else "Unknown"
```

**5. Line 1574 - `/base-information` POST endpoint**
```python
# Before
return jsonify({"success": True, "userId": result[user_id]}), 200

# After
return jsonify({"success": True, "userId": result["user_id"]}), 200
```

## Testing
After applying these fixes:
1. ✅ Login should work
2. ✅ Introduction screen loads properly
3. ✅ Condition analysis endpoints should work without NameError
4. ✅ Cached genetic analysis should load correctly

## Related Fixes
This fix is part of the database schema migration from PascalCase to snake_case column names. See also:
- `DATABASE_SCHEMA_UPDATE.md` - Main schema changes
- `FRONTEND_BACKEND_FIX.md` - API response transformation

## Deployment
Restart Docker containers to apply:
```bash
docker-compose restart backend
```

Or full rebuild:
```bash
docker-compose down
docker-compose up -d --build
```
