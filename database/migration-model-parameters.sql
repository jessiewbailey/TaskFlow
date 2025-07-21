-- Migration to add model parameters support to workflow blocks
-- This allows users to configure model-specific parameters like temperature, context window, etc.

ALTER TABLE workflow_blocks 
ADD COLUMN model_parameters JSON NULL COMMENT 'Model-specific parameters (temperature, max_tokens, etc.)' 
AFTER model_name;

-- Default parameters for existing blocks (optional)
-- UPDATE workflow_blocks 
-- SET model_parameters = JSON_OBJECT(
--     'temperature', 0.7,
--     'max_tokens', 2048,
--     'top_p', 0.9,
--     'top_k', 40,
--     'num_ctx', 4096
-- )
-- WHERE model_parameters IS NULL;