-- Add caching columns to BaseInformation table
-- This allows storing the LLM-generated analysis to avoid regenerating it on every page load
-- Split into two caches: Basic (fast) and Detailed (slower but comprehensive)

-- Check if columns exist before adding (safe for re-running)
DO $$ 
BEGIN
    -- Add CachedAnalysis column (stores full JSON text - legacy/backward compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'GenCom' 
        AND table_name = 'BaseInformation' 
        AND column_name = 'CachedAnalysis'
    ) THEN
        ALTER TABLE "GenCom"."BaseInformation" 
        ADD COLUMN "CachedAnalysis" TEXT NULL;
        
        RAISE NOTICE 'Added CachedAnalysis column';
    ELSE
        RAISE NOTICE 'CachedAnalysis column already exists';
    END IF;
    
    -- Add CachedAnalysisBasic column (stores basic info: condition, riskLevel, description)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'GenCom' 
        AND table_name = 'BaseInformation' 
        AND column_name = 'CachedAnalysisBasic'
    ) THEN
        ALTER TABLE "GenCom"."BaseInformation" 
        ADD COLUMN "CachedAnalysisBasic" TEXT NULL;
        
        RAISE NOTICE 'Added CachedAnalysisBasic column';
    ELSE
        RAISE NOTICE 'CachedAnalysisBasic column already exists';
    END IF;
    
    -- Add CachedAnalysisDetailed column (stores detailed info: implications, recommendations, resources)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'GenCom' 
        AND table_name = 'BaseInformation' 
        AND column_name = 'CachedAnalysisDetailed'
    ) THEN
        ALTER TABLE "GenCom"."BaseInformation" 
        ADD COLUMN "CachedAnalysisDetailed" TEXT NULL;
        
        RAISE NOTICE 'Added CachedAnalysisDetailed column';
    ELSE
        RAISE NOTICE 'CachedAnalysisDetailed column already exists';
    END IF;
    
    -- Add AnalysisCachedAt column (stores cache timestamp)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'GenCom' 
        AND table_name = 'BaseInformation' 
        AND column_name = 'AnalysisCachedAt'
    ) THEN
        ALTER TABLE "GenCom"."BaseInformation" 
        ADD COLUMN "AnalysisCachedAt" TIMESTAMP WITH TIME ZONE NULL;
        
        RAISE NOTICE 'Added AnalysisCachedAt column';
    ELSE
        RAISE NOTICE 'AnalysisCachedAt column already exists';
    END IF;
END $$;

-- Create index for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_base_information_cached_at 
ON "GenCom"."BaseInformation"("AnalysisCachedAt") 
WHERE "CachedAnalysis" IS NOT NULL;

COMMENT ON COLUMN "GenCom"."BaseInformation"."CachedAnalysis" IS 'JSON cache of LLM-generated condition analysis (expires after 7 days)';
COMMENT ON COLUMN "GenCom"."BaseInformation"."AnalysisCachedAt" IS 'Timestamp when analysis was cached (UTC)';

SELECT 'Migration complete!' AS status;

