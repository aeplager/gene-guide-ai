# CRITICAL: Database Trigger Fix Required

## Issue
Before the web scraping feature will work, you MUST fix a database trigger that's causing all saves to fail.

## Error Message
```
record "new" has no field "ModifiedDate"
CONTEXT: PL/pgSQL assignment "NEW."ModifiedDate" := now()"
PL/pgSQL function gencom.set_modifieddate() line 3 at assignment
```

## The Fix

Connect to your Azure PostgreSQL database and run this SQL:

```sql
CREATE OR REPLACE FUNCTION gencom.set_modifieddate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_date := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## How to Apply

### Option 1: Azure Portal Query Editor
1. Go to Azure Portal
2. Navigate to your PostgreSQL database: `dbcustomllm.postgres.database.azure.com`
3. Open Query Editor
4. Paste the SQL above
5. Click "Run"

### Option 2: psql Command Line
```bash
psql -h dbcustomllm.postgres.database.azure.com -U custom_llm_admin -d agentic_core -c "CREATE OR REPLACE FUNCTION gencom.set_modifieddate() RETURNS TRIGGER AS \$\$ BEGIN NEW.modified_date := now(); RETURN NEW; END; \$\$ LANGUAGE plpgsql;"
```

### Option 3: Use the SQL File
```bash
psql -h dbcustomllm.postgres.database.azure.com -U custom_llm_admin -d agentic_core -f fix_trigger_column_names.sql
```

## Verification

After running the fix, test by:
1. Restart Docker containers: `docker-compose restart backend`
2. Try saving data on the Introduction page
3. Should save successfully without trigger errors

## What This Does

The trigger automatically updates the `modified_date` column whenever a row is updated. When you renamed the column from `"ModifiedDate"` to `modified_date`, the trigger function wasn't updated, causing it to fail.

This fix updates the trigger to use the new lowercase column name.

## After Fixing

Once this is fixed, the web scraping feature will work automatically:
- User saves genetic data
- Background thread fetches ClinVar and MedlinePlus data
- Source documentation is stored in the database
- LLM analysis generates using the fetched data
