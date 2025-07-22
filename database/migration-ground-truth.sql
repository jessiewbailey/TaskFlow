-- Migration to add ground truth data support for fine-tuning
-- Allows users to provide correct values for AI-generated fields

USE taskflow_db;

-- Table to store ground truth values for AI outputs
CREATE TABLE ground_truth_data (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  workflow_block_id BIGINT NOT NULL,
  field_path VARCHAR(255) NOT NULL COMMENT 'JSON path to the field (e.g., summary, tag, score)',
  ai_value JSON COMMENT 'Original AI-generated value',
  ground_truth_value JSON NOT NULL COMMENT 'User-provided correct value',
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  notes TEXT COMMENT 'Optional notes about why this correction was made',
  
  -- Foreign key constraints
  CONSTRAINT fk_ground_truth_request 
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ground_truth_block 
    FOREIGN KEY (workflow_block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  CONSTRAINT fk_ground_truth_user 
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  
  -- Indexes for performance
  INDEX idx_ground_truth_request (request_id),
  INDEX idx_ground_truth_block (workflow_block_id),
  INDEX idx_ground_truth_field (field_path),
  
  -- Ensure one ground truth per field per request/block combination
  UNIQUE KEY unique_request_block_field (request_id, workflow_block_id, field_path)
);

-- Add fine-tuning mode preference to users table (if not exists)
-- Note: This column may already exist from previous migrations
-- ALTER TABLE users 
-- ADD COLUMN preferences JSON NULL COMMENT 'User preferences including fine_tuning_mode'
-- AFTER role;

-- Create a view for easy access to ground truth with context
CREATE VIEW ground_truth_with_context AS
SELECT 
  gt.id,
  gt.request_id,
  r.text as request_text,
  gt.workflow_block_id,
  wb.name as block_name,
  wb.prompt as block_prompt,
  gt.field_path,
  gt.ai_value,
  gt.ground_truth_value,
  gt.notes,
  gt.created_by,
  u.name as created_by_name,
  gt.created_at,
  gt.updated_at
FROM ground_truth_data gt
JOIN requests r ON gt.request_id = r.id
JOIN workflow_blocks wb ON gt.workflow_block_id = wb.id
JOIN users u ON gt.created_by = u.id;