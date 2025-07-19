-- TaskFlow Complete Database Initialization
-- This file combines the base schema with all migrations for a fresh install
-- MySQL 8.0+

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
  INDEX idx_is_default (is_default),
  
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

-- AI-generated outputs table
CREATE TABLE ai_outputs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  output_type VARCHAR(64) NOT NULL,
  content JSON NOT NULL,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_request_type (request_id, output_type),
  INDEX idx_created_at (created_at),
  
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

-- Processing jobs table for async tracking
CREATE TABLE processing_jobs (
  id VARCHAR(36) PRIMARY KEY,
  request_id BIGINT NOT NULL,
  workflow_id BIGINT,
  job_type ENUM('STANDARD','CUSTOM','WORKFLOW') DEFAULT 'WORKFLOW',
  status ENUM('PENDING','RUNNING','COMPLETED','FAILED') DEFAULT 'PENDING',
  custom_instructions TEXT,
  error_message TEXT,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status_created (status, created_at),
  INDEX idx_request_id (request_id),
  
  FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL
);

-- Workflow blocks table with model support
CREATE TABLE workflow_blocks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  name VARCHAR(128) NOT NULL,
  prompt TEXT NOT NULL,
  order_index INT NOT NULL,
  block_type ENUM('CORE','CUSTOM') DEFAULT 'CUSTOM',
  output_schema JSON,
  model_name VARCHAR(128) DEFAULT 'gemma3:1b' COMMENT 'AI model to use for this block',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_workflow_order (workflow_id, order_index),
  INDEX idx_workflow_blocks_model (model_name),
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Workflow block inputs
CREATE TABLE workflow_block_inputs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  block_id BIGINT NOT NULL,
  input_type ENUM('REQUEST_TEXT','BLOCK_OUTPUT') NOT NULL,
  source_block_id BIGINT,
  variable_name VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_block_id (block_id),
  
  FOREIGN KEY (block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  FOREIGN KEY (source_block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE
);

-- Dashboard configuration table
CREATE TABLE workflow_dashboard_configs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workflow_id BIGINT NOT NULL,
  fields JSON NOT NULL COMMENT 'Array of field configurations for dashboard display',
  layout ENUM('grid','list') DEFAULT 'grid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_workflow_dashboard (workflow_id),
  
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Custom instructions table for block-specific instructions
CREATE TABLE custom_instructions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  request_id BIGINT NOT NULL,
  workflow_block_id BIGINT NOT NULL,
  instruction_text TEXT NOT NULL,
  created_by BIGINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  
  CONSTRAINT fk_custom_instructions_request 
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_instructions_block 
      FOREIGN KEY (workflow_block_id) REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  CONSTRAINT fk_custom_instructions_user 
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  
  INDEX idx_custom_instructions_request (request_id),
  INDEX idx_custom_instructions_block (workflow_block_id),
  INDEX idx_custom_instructions_active (is_active),
  
  UNIQUE KEY unique_request_block_instruction (request_id, workflow_block_id)
);

-- Insert default users
INSERT INTO users (name, email, role) VALUES
  ('System Admin', 'admin@system.local', 'ADMIN'),
  ('Default Analyst', 'analyst@system.local', 'ANALYST');

-- Insert default workflows
INSERT INTO workflows (name, description, status, is_default, created_by) VALUES
  ('Default Task Processing', 'Standard task processing workflow with AI analysis', 'ACTIVE', TRUE, 1),
  ('Simple Workflow', 'Basic workflow for testing', 'DRAFT', FALSE, 1);

-- Insert workflow blocks for default workflow
INSERT INTO workflow_blocks (workflow_id, name, prompt, order_index, block_type, output_schema, model_name) VALUES
  (1, 'Extract Metadata', 'Extract basic metadata from the task text including dates, names, and key information.', 1, 'CORE', '{"required": true, "prompt_type": "extract_metadata"}', 'gemma3:1b'),
  (1, 'Classify Topic', 'Classify the main topic or category of this task. Return a single category name.', 2, 'CORE', '{"required": true, "prompt_type": "classify_topic"}', 'gemma3:1b'),
  (1, 'Summarize Task', 'Provide a concise 2-3 sentence summary of the task requirements.', 3, 'CORE', '{"required": true, "prompt_type": "summarize"}', 'gemma3:1b'),
  (1, 'Sensitivity Score', 'Rate the sensitivity of this task from 1-10, where 1 is public information and 10 is highly sensitive.', 4, 'CORE', '{"required": true, "prompt_type": "sensitivity_score"}', 'gemma3:1b'),
  (1, 'Suggest Actions', 'Suggest 3-5 specific actions to complete this task.', 5, 'CORE', '{"required": true, "prompt_type": "suggest_actions"}', 'gemma3:1b');

-- Insert workflow blocks for simple workflow
INSERT INTO workflow_blocks (workflow_id, name, prompt, order_index, block_type, output_schema, model_name) VALUES
  (2, 'Simple Analysis', 'Analyze this task and provide a brief overview.', 1, 'CUSTOM', '{"required": true}', 'gemma3:1b');

-- Insert workflow block inputs
INSERT INTO workflow_block_inputs (block_id, input_type, source_block_id, variable_name) VALUES
  (1, 'REQUEST_TEXT', NULL, 'text'),
  (2, 'REQUEST_TEXT', NULL, 'text'),
  (3, 'REQUEST_TEXT', NULL, 'text'),
  (4, 'REQUEST_TEXT', NULL, 'text'),
  (5, 'REQUEST_TEXT', NULL, 'text'),
  (5, 'BLOCK_OUTPUT', 3, 'summary'),
  (6, 'REQUEST_TEXT', NULL, 'text');

-- Insert dashboard configs
INSERT INTO workflow_dashboard_configs (workflow_id, fields, layout) VALUES
  (1, '[
    {"key": "metadata", "label": "Extracted Metadata", "type": "json", "width": "full"},
    {"key": "topic", "label": "Topic Classification", "type": "text", "width": "half"},
    {"key": "sensitivity", "label": "Sensitivity Score", "type": "number", "width": "half"},
    {"key": "summary", "label": "Task Summary", "type": "text", "width": "full"},
    {"key": "actions", "label": "Suggested Actions", "type": "list", "width": "full"}
  ]', 'grid'),
  (2, '[
    {"key": "analysis", "label": "Analysis Result", "type": "text", "width": "full"}
  ]', 'list');

-- Create indexes for performance
CREATE INDEX idx_requests_workflow ON requests(workflow_id);
CREATE INDEX idx_ai_outputs_request ON ai_outputs(request_id);
CREATE INDEX idx_processing_jobs_request ON processing_jobs(request_id);