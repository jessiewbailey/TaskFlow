-- Add system_prompt column to workflow_blocks table
ALTER TABLE workflow_blocks ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- Add comment to explain the column purpose
COMMENT ON COLUMN workflow_blocks.system_prompt IS 'Optional system prompt to guide the AI behavior for this specific block';