-- Fix database triggers to use lowercase column names
-- This fixes the error: record "new" has no field "ModifiedDate"

-- Drop and recreate the set_modifieddate trigger function with lowercase column names
CREATE OR REPLACE FUNCTION gencom.set_modifieddate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_date := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the trigger is attached to the correct tables
-- If triggers exist, they will automatically use the updated function

-- You can check which tables have this trigger with:
-- SELECT event_object_schema, event_object_table, trigger_name
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'gencom' AND trigger_name LIKE '%modifieddate%';

-- If you need to recreate the triggers, use this pattern:
-- DROP TRIGGER IF EXISTS trigger_name ON gencom.base_information;
-- CREATE TRIGGER trigger_name
-- BEFORE UPDATE ON gencom.base_information
-- FOR EACH ROW
-- EXECUTE FUNCTION gencom.set_modifieddate();

SELECT 'Trigger function updated successfully!' AS status;
