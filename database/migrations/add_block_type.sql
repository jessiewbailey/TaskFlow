-- Add block_type column to workflow_blocks table
ALTER TABLE workflow_blocks ADD COLUMN block_type ENUM('CORE', 'CUSTOM') DEFAULT 'CUSTOM';

-- Update existing blocks that should be marked as CORE
UPDATE workflow_blocks SET block_type = 'CORE' WHERE name IN ('Sensitivity Assessment', 'Topic Classification', 'Summary Generation');