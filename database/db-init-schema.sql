-- Schema from db-init-job.yaml
-- Extracted for comparison with actual database

CREATE DATABASE IF NOT EXISTS taskflow_db;
USE taskflow_db;

-- Users table for analysts, supervisors, and admins
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(256) UNIQUE NOT NULL,
  role ENUM('ANALYST','SUPERVISOR','ADMIN') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow management tables
CREATE TABLE workflows (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  status ENUM('DRAFT','ACTIVE','ARCHIVED') DEFAULT 'DRAFT',
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status_updated (status, updated_at),
  INDEX idx_created_by (created_by),
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Main requests table
CREATE TABLE requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  text MEDIUMTEXT NOT NULL,
  requester VARCHAR(256),
  date_received DATE DEFAULT (CURRENT_DATE),
  assigned_analyst_id BIGINT,
  workflow_id BIGINT,
  status ENUM('NEW','IN_REVIEW','PENDING','CLOSED') DEFAULT 'NEW',
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_analyst_status (assigned_analyst_id, status),
  INDEX idx_status_date (status, date_received),
  INDEX idx_due_date (due_date),
  
  FOREIGN KEY (assigned_analyst_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
);

-- AI processing outputs table
CREATE TABLE ai_outputs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  summary TEXT,
  topic VARCHAR(128),
  sensitivity_score DECIMAL(3,2),
  redactions_json JSON,
  custom_instructions TEXT,
  model_name VARCHAR(64),
  tokens_used INT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_request_version (request_id, version),
  
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

-- Job processing table for async AI tasks
CREATE TABLE processing_jobs (
  id VARCHAR(36) PRIMARY KEY,
  request_id BIGINT NOT NULL,
  workflow_id BIGINT,
  status ENUM('PENDING','RUNNING','COMPLETED','FAILED') DEFAULT 'PENDING',
  job_type ENUM('STANDARD','CUSTOM','WORKFLOW') DEFAULT 'STANDARD',
  custom_instructions TEXT,
  error_message TEXT,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_request_status (request_id, status),
  INDEX idx_status_created (status, created_at),
  
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
);

CREATE TABLE workflow_blocks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  prompt TEXT NOT NULL,
  order_index INT NOT NULL,
  block_type ENUM('CORE','CUSTOM') DEFAULT 'CUSTOM' NOT NULL,
  output_schema JSON,
  model_name VARCHAR(128) NULL COMMENT 'AI model to use for this block (e.g., gemma3:1b, llama2:7b)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_workflow_order (workflow_id, order_index),
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE TABLE workflow_block_inputs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  block_id BIGINT NOT NULL,
  input_type ENUM('REQUEST_TEXT','BLOCK_OUTPUT') NOT NULL,
  source_block_id BIGINT,
  variable_name VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_block_input (block_id),
  INDEX idx_source_block (source_block_id),
  
  FOREIGN KEY (block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  FOREIGN KEY (source_block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE
);

CREATE TABLE workflow_dashboard_configs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  fields JSON NOT NULL,
  layout ENUM('grid','list') DEFAULT 'grid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_workflow (workflow_id),
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- From migration-custom-instructions.sql
CREATE TABLE IF NOT EXISTS custom_instructions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    workflow_block_id BIGINT NOT NULL,
    instruction_text TEXT NOT NULL,
    created_by BIGINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
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