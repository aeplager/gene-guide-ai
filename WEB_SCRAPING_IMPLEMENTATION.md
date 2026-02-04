# Web Scraping Implementation - ClinVar and MedlinePlus Integration

## Overview
The application now automatically fetches genetic variant documentation from ClinVar and MedlinePlus when users save their genetic data on the Introduction page.

## What Was Implemented

### 1. New Web Scraping Module
**File**: `genetic_web_scraper.py`

Functions:
- `search_clinvar(gene, mutation)` - Fetches ClinVar variant-specific data
- `search_medlineplus(gene)` - Fetches MedlinePlus gene information
- `search_all_sources(gene, mutation)` - Combines both sources

Features:
- Built-in rate limiting (1 req/sec for ClinVar, 0.5 req/sec for MedlinePlus)
- Clean text extraction (removes navigation, headers, footers)
- Error handling (returns error dict instead of crashing)
- Classification extraction from ClinVar (Pathogenic, Benign, VUS, etc.)

### 2. Updated Dependencies
**File**: `requirements.txt`

Added:
- `beautifulsoup4==4.12.3` - HTML parsing
- `lxml==5.1.0` - Fast XML/HTML parser

### 3. Modified Backend Save Endpoint
**File**: `app.py`

**Changes in `save_base_information()` function:**

1. **Import added** (line 14):
   ```python
   from genetic_web_scraper import search_all_sources
   ```

2. **UPDATE SQL modified** (lines 1352-1365):
   - Added `source_document = NULL`
   - Added `source_url = NULL`
   - Added `source_retrieved_at = NULL`
   - These are cleared when genetic data changes (will be refetched)

3. **Background thread enhanced** (lines 1436-1472):
   - **STEP 0**: Fetch ClinVar + MedlinePlus data (NEW)
   - Store in `source_document`, `source_url`, `source_retrieved_at`
   - **STEP 1**: Generate basic LLM analysis (existing)
   - **STEP 2**: Generate detailed LLM analysis (existing)

## How It Works

### User Flow
1. User fills out Introduction form with gene and mutation
2. User clicks "Save and Continue"
3. Backend immediately saves genetic data and returns success
4. Background thread starts (non-blocking):
   - Fetches ClinVar data for the specific variant
   - Fetches MedlinePlus data for the gene
   - Stores combined text in database
   - Generates LLM analysis using the fetched data

### Data Storage
**Database columns in `gencom.base_information`:**

- `source_document` (TEXT) - Combined text from ClinVar and MedlinePlus
- `source_url` (TEXT) - URLs separated by semicolon (e.g., "https://clinvar.url; https://medlineplus.url")
- `source_retrieved_at` (TIMESTAMP) - When the data was fetched (UTC)

### Example Data
```
source_document: 
=== ClinVar Data ===
URL: https://www.ncbi.nlm.nih.gov/clinvar/variation/12345/

[Full ClinVar page text...]

================================================================================

=== MedlinePlus Genetics Data ===
URL: https://medlineplus.gov/genetics/gene/brca1/

[Full MedlinePlus page text...]

source_url: https://www.ncbi.nlm.nih.gov/clinvar/variation/12345/; https://medlineplus.gov/genetics/gene/brca1/

source_retrieved_at: 2026-02-04 00:15:30.123456+00:00
```

## Error Handling

If web scraping fails:
- Error is logged to backend logs
- Source fields remain NULL
- Save operation continues successfully
- LLM analysis still generates
- User is not blocked or notified

## Performance

- **User experience**: Immediate response (~200ms)
- **Background processing**: 3-5 seconds total
  - ClinVar fetch: ~2-3 seconds
  - MedlinePlus fetch: ~1-2 seconds
  - LLM analysis: ~2-3 seconds (existing)
- **Rate limiting**: Prevents overwhelming external servers
- **Caching**: Data stored in database, no need to refetch

## Testing

### Manual Test Steps
1. Navigate to `http://localhost:8090/introduction`
2. Fill out the form:
   - Relationship: "My Child"
   - Gene: "COL1A1"
   - Mutation: "c.3889G>T"
   - Classification: "Likely Pathogenic"
3. Click "Save and Continue"
4. Check backend logs for:
   ```
   🌐 Background: Fetching ClinVar and MedlinePlus data for COL1A1 c.3889G>T
   [ClinVar] Searching for: COL1A1 c.3889G>T
   [ClinVar] Fetching: https://...
   [MedlinePlus] Fetching: https://medlineplus.gov/genetics/gene/col1a1/
   ✅ Background: Stored web sources for user ... from ClinVar, MedlinePlus
   ```

5. Query database to verify:
   ```sql
   SELECT 
       gene, 
       mutation, 
       source_url, 
       source_retrieved_at,
       length(source_document) as doc_length
   FROM gencom.base_information
   WHERE user_id = 'your-user-id';
   ```

### Expected Results
- `source_url`: Should contain both URLs
- `source_document`: Should contain combined text (several KB)
- `source_retrieved_at`: Should have current timestamp
- Backend logs: Should show successful fetches

## Important Notes

### Database Trigger Fix Required
**CRITICAL**: Before this works, you must fix the database trigger:

Run this SQL in your Azure PostgreSQL database:
```sql
CREATE OR REPLACE FUNCTION gencom.set_modifieddate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_date := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Without this fix, all saves will fail with:
```
record "new" has no field "ModifiedDate"
```

### Deployment
After fixing the trigger, rebuild Docker containers:
```bash
docker-compose down
docker-compose up -d --build
```

This will:
- Install new dependencies (beautifulsoup4, lxml)
- Load the new web scraping module
- Apply the updated backend code

## Future Enhancements

Consider adding:
1. **Retry logic** - Retry failed web requests
2. **Caching** - Don't refetch if source data exists and is recent
3. **More sources** - Add OMIM, GeneCards, etc.
4. **Source selection** - Let users choose which sources to fetch
5. **Manual refresh** - Button to refetch source data
6. **Source display** - Show fetched documentation in UI

## Troubleshooting

### Web scraping fails
- Check backend logs for specific error
- Verify internet connectivity from Docker container
- Check if ClinVar/MedlinePlus sites are accessible
- Verify rate limiting isn't too aggressive

### Data not stored
- Check database logs for constraint violations
- Verify source columns exist in table
- Check if trigger is updated correctly

### Slow performance
- Web scraping runs in background (shouldn't affect user)
- Check if rate limiting is causing delays
- Monitor LLM response times
