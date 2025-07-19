-- Migration: Add custom instructions table for block-specific instructions

CREATE TABLE IF NOT EXISTS custom_instructions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    workflow_block_id BIGINT NOT NULL, -- NULL means applies to entire workflow
    instruction_text TEXT NOT NULL,
    created_by BIGINT DEFAULT 1, -- User who created the instruction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE, -- Allow disabling without deleting
    
    -- Foreign key constraints
    CONSTRAINT fk_custom_instructions_request 
        FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_custom_instructions_block 
        FOREIGN KEY (workflow_block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE,
    CONSTRAINT fk_custom_instructions_user 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes for performance
    INDEX idx_custom_instructions_request (request_id),
    INDEX idx_custom_instructions_block (workflow_block_id),
    INDEX idx_custom_instructions_active (is_active),
    
    -- Unique constraint to prevent duplicate instructions for same request/block
    UNIQUE KEY unique_request_block_instruction (request_id, workflow_block_id)
);