# Database Schema Update - Lowercase Column Names

## Summary
Updated all database table and column references from PascalCase with double quotes to lowercase with underscores (snake_case) without quotes.

## Changes Made

### Tables Renamed
| Old Name | New Name |
|----------|----------|
| `"GenCom"."BaseInformation"` | `gencom.base_information` |
| `"GenCom"."ClassificationType"` | `gencom.classification_type` |
| `"GenCom"."PersonaTestType"` | `gencom.persona_test_type` |

### Column Names Updated

#### base_information table
| Old Name | New Name |
|----------|----------|
| `"UserID"` | `user_id` |
| `"PersonaTestTypeID"` | `persona_test_type_id` |
| `"ClassificationTypeID"` | `classification_type_id` |
| `"Uploaded"` | `uploaded` |
| `"Gene"` | `gene` |
| `"Mutation"` | `mutation` |
| `"InsertDate"` | `insert_date` |
| `"ModifiedDate"` | `modified_date` |
| `"CachedAnalysis"` | `cached_analysis` |
| `"AnalysisCachedAt"` | `analysis_cached_at` |
| `"CachedAnalysisBasic"` | `cached_analysis_basic` |
| `"CachedAnalysisDetailed"` | `cached_analysis_detailed` |

#### classification_type table
| Old Name | New Name |
|----------|----------|
| `"ClassificationTypeID"` | `classification_type_id` |
| `"ClassificationType"` | `classification_type` |
| `"InsertDate"` | `insert_date` |
| `"ModifiedDate"` | `modified_date` |

#### persona_test_type table
| Old Name | New Name |
|----------|----------|
| `"PersonaTestTypeID"` | `persona_test_type_id` |
| `"PersonaTestType"` | `persona_test_type` |
| `"InsertDate"` | `insert_date` |
| `"ModifiedDate"` | `modified_date` |

## Files Modified

### 1. `app.py` (Backend)
- Updated all SQL queries to use lowercase table and column names
- Updated all `result.get()` and `result[]` dictionary access to use lowercase keys
- Updated all INSERT and UPDATE statements
- Updated all JOIN conditions

### 2. `database_migration_add_cache.sql`
- Updated schema references from `'GenCom'` to `'gencom'`
- Updated table references from `'BaseInformation'` to `'base_information'`
- Updated all column names to lowercase with underscores
- Updated index creation statement
- Updated COMMENT statements

### 3. `run_migration.py`
- Updated docstring to reference lowercase table name
- Updated output messages to show lowercase column names

## Testing Checklist

After deploying these changes, verify the following endpoints work correctly:

- [ ] `GET /healthz` - Health check
- [ ] `POST /vapi/personalized-greeting` - Vapi greeting generation
- [ ] `POST /tavus/personalized-greeting` - Tavus greeting generation
- [ ] `GET /persona-test-types` - Fetch persona test types
- [ ] `GET /classification-types` - Fetch classification types
- [ ] `POST /base-information` - Save user genetic data
- [ ] `GET /base-information/<user_id>` - Fetch user genetic data
- [ ] `GET /condition-basic/<user_id>` - Get basic condition analysis
- [ ] `GET /condition-detailed/<user_id>` - Get detailed condition analysis
- [ ] `GET /condition/<user_id>` - Get full condition analysis (legacy)

## Database Migration

If you need to rename the actual database tables and columns to match the new naming convention, run the following SQL:

```sql
-- Rename tables (if needed)
ALTER TABLE "GenCom"."BaseInformation" RENAME TO base_information;
ALTER TABLE "GenCom"."ClassificationType" RENAME TO classification_type;
ALTER TABLE "GenCom"."PersonaTestType" RENAME TO persona_test_type;

-- Rename columns in base_information
ALTER TABLE gencom.base_information RENAME COLUMN "UserID" TO user_id;
ALTER TABLE gencom.base_information RENAME COLUMN "PersonaTestTypeID" TO persona_test_type_id;
ALTER TABLE gencom.base_information RENAME COLUMN "ClassificationTypeID" TO classification_type_id;
ALTER TABLE gencom.base_information RENAME COLUMN "Uploaded" TO uploaded;
ALTER TABLE gencom.base_information RENAME COLUMN "Gene" TO gene;
ALTER TABLE gencom.base_information RENAME COLUMN "Mutation" TO mutation;
ALTER TABLE gencom.base_information RENAME COLUMN "InsertDate" TO insert_date;
ALTER TABLE gencom.base_information RENAME COLUMN "ModifiedDate" TO modified_date;
ALTER TABLE gencom.base_information RENAME COLUMN "CachedAnalysis" TO cached_analysis;
ALTER TABLE gencom.base_information RENAME COLUMN "AnalysisCachedAt" TO analysis_cached_at;
ALTER TABLE gencom.base_information RENAME COLUMN "CachedAnalysisBasic" TO cached_analysis_basic;
ALTER TABLE gencom.base_information RENAME COLUMN "CachedAnalysisDetailed" TO cached_analysis_detailed;

-- Rename columns in classification_type
ALTER TABLE gencom.classification_type RENAME COLUMN "ClassificationTypeID" TO classification_type_id;
ALTER TABLE gencom.classification_type RENAME COLUMN "ClassificationType" TO classification_type;
ALTER TABLE gencom.classification_type RENAME COLUMN "InsertDate" TO insert_date;
ALTER TABLE gencom.classification_type RENAME COLUMN "ModifiedDate" TO modified_date;

-- Rename columns in persona_test_type
ALTER TABLE gencom.persona_test_type RENAME COLUMN "PersonaTestTypeID" TO persona_test_type_id;
ALTER TABLE gencom.persona_test_type RENAME COLUMN "PersonaTestType" TO persona_test_type;
ALTER TABLE gencom.persona_test_type RENAME COLUMN "InsertDate" TO insert_date;
ALTER TABLE gencom.persona_test_type RENAME COLUMN "ModifiedDate" TO modified_date;
```

## Notes

- PostgreSQL is case-insensitive for unquoted identifiers, so removing the double quotes makes the code cleaner
- All lowercase with underscores follows Python/PostgreSQL naming conventions
- The application code now matches the database schema you provided
- No functionality changes - only naming convention updates
