-- Migration: Remove deprecated columns from ai_outputs table
-- Date: 2024-01-31
-- Description: Remove legacy columns that were used for hardcoded workflows

-- Drop the deprecated columns
ALTER TABLE ai_outputs 
DROP COLUMN IF EXISTS topic,
DROP COLUMN IF EXISTS sensitivity_score,
DROP COLUMN IF EXISTS redactions_json,
DROP COLUMN IF EXISTS custom_instructions;

-- Add comment to explain the summary column is now the primary data store
COMMENT ON COLUMN ai_outputs.summary IS 'JSON string containing all workflow outputs. Keys are block names, values are block outputs.';