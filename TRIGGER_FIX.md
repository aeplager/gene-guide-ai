# Database Trigger Fix - ModifiedDate Column

## Issue
When saving data to `gencom.base_information`, the application crashes with:
```
psycopg2.errors.UndefinedColumn: record "new" has no field "ModifiedDate"
CONTEXT: PL/pgSQL assignment "NEW."ModifiedDate" := now()"
PL/pgSQL function gencom.set_modifieddate() line 3 at assignment
```

## Root Cause
There's a PostgreSQL trigger function `gencom.set_modifieddate()` that automatically updates the `ModifiedDate` column on every UPDATE. When you renamed the column from `"ModifiedDate"` to `modified_date`, the trigger function was not updated.

**Old trigger code:**
```sql
CREATE OR REPLACE FUNCTION gencom.set_modifieddate()
RETURNS TRIGGER AS $$
BEGIN
    NEW."ModifiedDate" := now();  -- ❌ Column no longer exists!
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**New trigger code:**
```sql
CREATE OR REPLACE FUNCTION gencom.set_modifieddate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_date := now();  -- ✅ Updated column name
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Solution

### Option 1: Run Python Script (Recommended)
```bash
python fix_trigger.py
```

This will:
1. Connect to your Azure PostgreSQL database
2. Update the trigger function to use lowercase column names
3. Verify the change was successful

### Option 2: Run SQL Directly
Connect to your database and run:
```sql
CREATE OR REPLACE FUNCTION gencom.set_modifieddate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_date := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Option 3: Use the SQL File
```bash
psql -h dbcustomllm.postgres.database.azure.com -U your_user -d agentic_core -f fix_trigger_column_names.sql
```

## Files Created

1. **`fix_trigger_column_names.sql`** - SQL script to update the trigger function
2. **`fix_trigger.py`** - Python script to run the SQL fix automatically
3. **`TRIGGER_FIX.md`** - This documentation file

## After Applying the Fix

1. Restart your Docker backend (or it will auto-reload):
   ```bash
   docker-compose restart backend
   ```

2. Test saving data in the Introduction screen:
   - Navigate to `/introduction`
   - Fill out the form
   - Click "Save and Continue"
   - Should save successfully without errors

## Other Triggers to Check

If you have similar triggers on other tables (like `classification_type` or `persona_test_type`), they may also need updating. Check with:

```sql
SELECT 
    trigger_schema,
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'gencom'
ORDER BY event_object_table, trigger_name;
```

Look for any triggers that reference PascalCase column names and update them accordingly.

## Prevention

When renaming database columns in the future:
1. ✅ Update application code (Python, TypeScript)
2. ✅ Update SQL queries
3. ✅ **Update database triggers** ⚠️ (often forgotten!)
4. ✅ Update stored procedures (if any)
5. ✅ Update views (if any)
6. ✅ Update indexes (if they reference column names in expressions)
