-- Migration: Add model field to workflow_blocks table
-- This allows each workflow block to specify which AI model to use

USE taskflow_db;

-- Add model field to workflow_blocks table
ALTER TABLE workflow_blocks 
ADD COLUMN model_name VARCHAR(128) NULL 
COMMENT 'AI model to use for this block (e.g., gemma3:1b, llama2:7b)'
AFTER output_schema;

-- Set default model for existing blocks
UPDATE workflow_blocks 
SET model_name = 'gemma3:1b' 
WHERE model_name IS NULL;

-- Add index for model queries
CREATE INDEX idx_workflow_blocks_model ON workflow_blocks(model_name);

-- Update existing workflow blocks with appropriate models
-- CORE blocks use the default model, CUSTOM blocks can specify their own
UPDATE workflow_blocks 
SET model_name = CASE 
    WHEN block_type = 'CORE' THEN 'gemma3:1b'
    WHEN name LIKE '%Classification%' OR name LIKE '%Classify%' THEN 'gemma3:1b'
    WHEN name LIKE '%Summary%' OR name LIKE '%Summarize%' THEN 'gemma3:1b'
    WHEN name LIKE '%Extract%' THEN 'gemma3:1b'
    WHEN name LIKE '%Sensitivity%' OR name LIKE '%Score%' THEN 'gemma3:1b'
    ELSE 'gemma3:1b'
END;