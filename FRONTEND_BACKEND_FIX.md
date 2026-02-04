# Frontend-Backend Column Name Compatibility Fix

## Issue
After renaming database columns from PascalCase to snake_case, the frontend was receiving data with lowercase keys but expecting PascalCase keys, causing a crash with:
```
TypeError: Cannot read properties of undefined (reading 'toString')
```

## Root Cause
- **Database columns**: Changed from `ClassificationTypeID` to `classification_type_id`
- **Backend queries**: Updated to use snake_case column names
- **Frontend code**: Still expecting PascalCase keys in the response

## Solution Applied
Added response transformation in two backend endpoints to convert snake_case database column names to PascalCase keys for frontend compatibility.

### Files Modified

#### `app.py`

**1. `/persona-test-types` endpoint (lines ~1214-1227)**
- **Before**: Returned `{"persona_test_type_id": 1, "persona_test_type": "Self"}`
- **After**: Returns `{"PersonaTestTypeID": 1, "PersonaTestType": "Self"}`

**2. `/classification-types` endpoint (lines ~1250-1263)**
- **Before**: Returned `{"classification_type_id": 1, "classification_type": "Pathogenic"}`
- **After**: Returns `{"ClassificationTypeID": 1, "ClassificationType": "Pathogenic"}`

### Code Changes

Both endpoints now include transformation logic:
```python
# Transform snake_case keys to PascalCase for frontend compatibility
transformed_results = [
    {
        "PersonaTestTypeID": row["persona_test_type_id"],
        "PersonaTestType": row["persona_test_type"]
    }
    for row in results
]
return jsonify(transformed_results), 200
```

## Testing
After deploying these changes:
1. ✅ Login should work
2. ✅ Introduction screen should load without white screen
3. ✅ Dropdowns for "Relationship" and "Classification Type" should populate correctly
4. ✅ Form submission should work properly

## Notes
- The `/base-information` endpoint already uses camelCase (e.g., `personaTestTypeId`) which is compatible with the frontend
- This is a temporary compatibility layer - consider standardizing on camelCase across the entire application in the future
- Database still uses snake_case (PostgreSQL standard)
- Backend queries use snake_case
- API responses use PascalCase/camelCase (JavaScript standard)

## Future Improvements
Consider migrating the entire application to use camelCase consistently:
- Database: Keep snake_case (PostgreSQL convention)
- Backend internal: snake_case (Python convention)
- API responses: camelCase (JavaScript convention)
- Frontend: camelCase (JavaScript convention)
