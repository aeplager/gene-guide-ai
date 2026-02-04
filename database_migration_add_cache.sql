-- Add caching columns to base_information table
-- This allows storing the LLM-generated analysis to avoid regenerating it on every page load
-- Split into two caches: Basic (fast) and Detailed (slower but comprehensive)

-- Check if columns exist before adding (safe for re-running)
DO $$ 
BEGIN
    -- Add cached_analysis column (stores full JSON text - legacy/backward compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'gencom' 
        AND table_name = 'base_information' 
        AND column_name = 'cached_analysis'
    ) THEN
        ALTER TABLE gencom.base_information 
        ADD COLUMN cached_analysis TEXT NULL;
        
        RAISE NOTICE 'Added cached_analysis column';
    ELSE
        RAISE NOTICE 'cached_analysis column already exists';
    END IF;
    
    -- Add cached_analysis_basic column (stores basic info: condition, riskLevel, description)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'gencom' 
        AND table_name = 'base_information' 
        AND column_name = 'cached_analysis_basic'
    ) THEN
        ALTER TABLE gencom.base_information 
        ADD COLUMN cached_analysis_basic TEXT NULL;
        
        RAISE NOTICE 'Added cached_analysis_basic column';
    ELSE
        RAISE NOTICE 'cached_analysis_basic column already exists';
    END IF;
    
    -- Add cached_analysis_detailed column (stores detailed info: implications, recommendations, resources)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'gencom' 
        AND table_name = 'base_information' 
        AND column_name = 'cached_analysis_detailed'
    ) THEN
        ALTER TABLE gencom.base_information 
        ADD COLUMN cached_analysis_detailed TEXT NULL;
        
        RAISE NOTICE 'Added cached_analysis_detailed column';
    ELSE
        RAISE NOTICE 'cached_analysis_detailed column already exists';
    END IF;
    
    -- Add analysis_cached_at column (stores cache timestamp)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'gencom' 
        AND table_name = 'base_information' 
        AND column_name = 'analysis_cached_at'
    ) THEN
        ALTER TABLE gencom.base_information 
        ADD COLUMN analysis_cached_at TIMESTAMP WITH TIME ZONE NULL;
        
        RAISE NOTICE 'Added analysis_cached_at column';
    ELSE
        RAISE NOTICE 'analysis_cached_at column already exists';
    END IF;
END $$;

-- Create index for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_base_information_cached_at 
ON gencom.base_information(analysis_cached_at) 
WHERE cached_analysis IS NOT NULL;

COMMENT ON COLUMN gencom.base_information.cached_analysis IS 'JSON cache of LLM-generated condition analysis (expires after 7 days)';
COMMENT ON COLUMN gencom.base_information.analysis_cached_at IS 'Timestamp when analysis was cached (UTC)';

SELECT 'Migration complete!' AS status;

