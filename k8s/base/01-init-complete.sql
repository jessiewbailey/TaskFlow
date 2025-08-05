-- TaskFlow Request Processing Application Database Schema
-- PostgreSQL 15+

-- Create database (run as superuser if needed)
-- CREATE DATABASE taskflow_db;

-- Use the database
\c taskflow_db;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('ANALYST', 'SUPERVISOR', 'ADMIN');
CREATE TYPE request_status AS ENUM ('NEW', 'IN_REVIEW', 'PENDING', 'CLOSED');
CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE job_type AS ENUM ('STANDARD', 'CUSTOM', 'WORKFLOW', 'EMBEDDING', 'BULK_EMBEDDING');
CREATE TYPE workflow_status AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE block_type AS ENUM ('CORE', 'CUSTOM');
CREATE TYPE block_input_type AS ENUM ('REQUEST_TEXT', 'BLOCK_OUTPUT');
CREATE TYPE embedding_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE dashboard_layout AS ENUM ('grid', 'list');

-- Users table
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(256) UNIQUE NOT NULL,
  role user_role NOT NULL,
  preferences JSONB DEFAULT '{}' NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow management tables
CREATE TABLE workflows (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  status workflow_status DEFAULT 'DRAFT',
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for workflows
CREATE INDEX idx_workflows_status_updated ON workflows(status, updated_at);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_is_default ON workflows(is_default);

-- Main requests table
CREATE TABLE requests (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  requester VARCHAR(256),
  date_received DATE DEFAULT CURRENT_DATE,
  assigned_analyst_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  workflow_id BIGINT REFERENCES workflows(id) ON DELETE SET NULL,
  status request_status DEFAULT 'NEW',
  embedding_status embedding_status DEFAULT 'PENDING',
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for requests
CREATE INDEX idx_requests_analyst_status ON requests(assigned_analyst_id, status);
CREATE INDEX idx_requests_status_date ON requests(status, date_received);
CREATE INDEX idx_requests_due_date ON requests(due_date);
CREATE INDEX idx_requests_workflow ON requests(workflow_id);
CREATE INDEX idx_requests_embedding_status ON requests(embedding_status);

-- AI processing outputs table
CREATE TABLE ai_outputs (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  summary TEXT, -- JSON string containing all workflow outputs
  model_name VARCHAR(64),
  tokens_used INT,
  duration_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ai_outputs
CREATE INDEX idx_ai_outputs_request_version ON ai_outputs(request_id, version);
CREATE INDEX idx_ai_outputs_request ON ai_outputs(request_id);

-- Job processing table
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  workflow_id BIGINT REFERENCES workflows(id) ON DELETE SET NULL,
  job_type job_type DEFAULT 'WORKFLOW',
  status job_status DEFAULT 'PENDING',
  custom_instructions TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NULL,
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for processing_jobs
CREATE INDEX idx_processing_jobs_status_created ON processing_jobs(status, created_at);
CREATE INDEX idx_processing_jobs_request ON processing_jobs(request_id);
CREATE INDEX idx_processing_jobs_retry_count ON processing_jobs(retry_count);

-- Workflow blocks table
CREATE TABLE workflow_blocks (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(128) NOT NULL,
  prompt TEXT NOT NULL,
  order_index INT NOT NULL,
  block_type block_type DEFAULT 'CUSTOM',
  output_schema JSONB,
  model_name VARCHAR(128) DEFAULT 'gemma3:1b',
  model_parameters JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for workflow_blocks
CREATE INDEX idx_workflow_blocks_workflow_order ON workflow_blocks(workflow_id, order_index);
CREATE INDEX idx_workflow_blocks_model ON workflow_blocks(model_name);
-- GIN index for JSONB columns
CREATE INDEX idx_workflow_blocks_output_schema ON workflow_blocks USING GIN (output_schema);
CREATE INDEX idx_workflow_blocks_model_params ON workflow_blocks USING GIN (model_parameters);

-- Workflow block inputs table
CREATE TABLE workflow_block_inputs (
  id BIGSERIAL PRIMARY KEY,
  block_id BIGINT NOT NULL REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  input_type block_input_type NOT NULL,
  source_block_id BIGINT REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  variable_name VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for workflow_block_inputs
CREATE INDEX idx_workflow_block_inputs_block ON workflow_block_inputs(block_id);

-- Dashboard configuration table
CREATE TABLE workflow_dashboard_configs (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  fields JSONB NOT NULL,
  layout dashboard_layout DEFAULT 'grid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id)
);

-- GIN index for dashboard fields
CREATE INDEX idx_dashboard_configs_fields ON workflow_dashboard_configs USING GIN (fields);

-- Workflow embedding configuration table
CREATE TABLE workflow_embedding_configs (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  embedding_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id)
);

-- Index for embedding configs
CREATE INDEX idx_workflow_embedding_configs_workflow_id ON workflow_embedding_configs(workflow_id);

-- Workflow similarity configuration table
CREATE TABLE workflow_similarity_configs (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id)
);

-- GIN index for similarity config fields
CREATE INDEX idx_workflow_similarity_configs_fields ON workflow_similarity_configs USING GIN (fields);

-- Index for similarity configs
CREATE INDEX idx_workflow_similarity_configs_workflow_id ON workflow_similarity_configs(workflow_id);

-- Custom instructions table
CREATE TABLE custom_instructions (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  workflow_block_id BIGINT NOT NULL REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  instruction_text TEXT NOT NULL,
  created_by BIGINT DEFAULT 1 REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(request_id, workflow_block_id)
);

-- Create indexes for custom_instructions
CREATE INDEX idx_custom_instructions_request ON custom_instructions(request_id);
CREATE INDEX idx_custom_instructions_block ON custom_instructions(workflow_block_id);
CREATE INDEX idx_custom_instructions_active ON custom_instructions(is_active);

-- Ground truth data for fine-tuning
CREATE TABLE ground_truth_data (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  workflow_block_id BIGINT NOT NULL REFERENCES workflow_blocks(id) ON DELETE CASCADE,
  field_path VARCHAR(255) NOT NULL,
  ai_value JSONB,
  ground_truth_value JSONB NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE(request_id, workflow_block_id, field_path)
);

-- Create indexes for ground_truth_data
CREATE INDEX idx_ground_truth_request ON ground_truth_data(request_id);
CREATE INDEX idx_ground_truth_block ON ground_truth_data(workflow_block_id);
CREATE INDEX idx_ground_truth_field ON ground_truth_data(field_path);
-- GIN indexes for JSONB columns
CREATE INDEX idx_ground_truth_ai_value ON ground_truth_data USING GIN (ai_value);
CREATE INDEX idx_ground_truth_value ON ground_truth_data USING GIN (ground_truth_value);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_blocks_updated_at BEFORE UPDATE ON workflow_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_configs_updated_at BEFORE UPDATE ON workflow_dashboard_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_embedding_configs_updated_at BEFORE UPDATE ON workflow_embedding_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_similarity_configs_updated_at BEFORE UPDATE ON workflow_similarity_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_instructions_updated_at BEFORE UPDATE ON custom_instructions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ground_truth_updated_at BEFORE UPDATE ON ground_truth_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create ground truth view
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

-- Create exercises table
CREATE TABLE exercises (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active exercises sorted by name
CREATE INDEX idx_exercises_active_name ON exercises(is_active, name);

-- Create unique partial index to ensure only one default exercise
CREATE UNIQUE INDEX idx_exercises_default ON exercises(is_default) WHERE is_default = TRUE;

-- Add exercise_id to requests table
ALTER TABLE requests ADD COLUMN exercise_id BIGINT REFERENCES exercises(id) ON DELETE SET NULL;
CREATE INDEX idx_requests_exercise ON requests(exercise_id);

-- Create exercise permissions table
CREATE TABLE exercise_permissions (
  id BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_level VARCHAR(32) NOT NULL DEFAULT 'read',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exercise_id, user_id)
);

-- Create indexes for exercise permissions
CREATE INDEX idx_exercise_permissions_user ON exercise_permissions(user_id);
CREATE INDEX idx_exercise_permissions_exercise ON exercise_permissions(exercise_id);

-- Add trigger to update exercises.updated_at
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create system settings table for global application settings
CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(128) NOT NULL UNIQUE,
    value JSON NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES 
    ('rag_search_enabled', '"true"', 'Enable/disable RAG search feature visibility')
ON CONFLICT (key) DO NOTHING;

-- Create trigger for system_settings updated_at
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE
    ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default users
INSERT INTO users (name, email, role) VALUES
  ('System Admin', 'admin@system.local', 'ADMIN'),
  ('Default Analyst', 'analyst@system.local', 'ANALYST');

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO taskflow_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO taskflow_user;

-- Insert a default exercise
INSERT INTO exercises (name, description, is_default, created_by) 
VALUES ('Default Exercise', 'Default exercise for all tasks', TRUE, 1);

-- Add UI visibility settings to system_settings table
INSERT INTO system_settings (key, value, description) VALUES 
    ('ui_show_logs_button', '"true"', 'Show/hide the logs button in the dashboard'),
    ('ui_show_similarity_features', '"true"', 'Show/hide similarity features (RAG search sidebar and Similar Tasks tab)')
ON CONFLICT (key) DO NOTHING;
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
COMMENT ON COLUMN ai_outputs.summary IS 'JSON string containing all workflow outputs. Keys are block names, values are block outputs.';-- Migration: Add custom_instructions column to processing_jobs
-- Date: 2025-07-31
-- Author: System
-- Purpose: Add missing custom_instructions column that the API expects

-- Add the custom_instructions column to processing_jobs table
ALTER TABLE processing_jobs 
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN processing_jobs.custom_instructions IS 'Optional custom instructions for this specific job execution';

-- Migration: Add webhooks table for external notifications
-- Description: Creates webhook configuration table to allow external systems to receive TaskFlow events

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    events TEXT[] NOT NULL, -- Array of event types to subscribe to
    headers JSONB DEFAULT '{}', -- Custom headers to include in webhook calls
    is_active BOOLEAN DEFAULT true,
    secret_token VARCHAR(255), -- For webhook signature verification
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_triggered_at TIMESTAMP,
    
    CONSTRAINT webhook_name_unique UNIQUE (name)
);

-- Create indexes for performance
CREATE INDEX idx_webhooks_active ON webhooks(is_active);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- Table to track webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'success', 'failed'
    attempts INTEGER DEFAULT 0,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for querying recent deliveries
    CONSTRAINT webhook_delivery_status_check CHECK (status IN ('pending', 'success', 'failed'))
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_updated_at();

-- Comments for documentation
COMMENT ON TABLE webhooks IS 'Stores webhook configurations for external event notifications';
COMMENT ON COLUMN webhooks.events IS 'Array of event types this webhook subscribes to (e.g., job.completed, request.created)';
COMMENT ON COLUMN webhooks.headers IS 'Custom HTTP headers to include in webhook requests';
COMMENT ON COLUMN webhooks.secret_token IS 'Used to generate HMAC signatures for webhook payload verification';

COMMENT ON TABLE webhook_deliveries IS 'Tracks webhook delivery attempts and their results';
COMMENT ON COLUMN webhook_deliveries.event_data IS 'The actual event payload that was/will be sent';
-- ============================================
-- Migration: Add pgvector support for embeddings
-- Date: 2024-08-03
-- ============================================

-- Add pgvector extension for embedding support
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding_vector column to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS requests_embedding_vector_idx 
ON requests 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- Migration: Add workflow embedding configuration
-- Date: 2024-08-04
-- ============================================

-- Create table for workflow embedding configuration
CREATE TABLE IF NOT EXISTS workflow_embedding_configs (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT true,
    -- Template for building embedding text using workflow outputs
    embedding_template TEXT NOT NULL,
    -- Example: "Summary: {{Summarize Content.executive_summary}}\nTopics: {{Classify Topic.primary_topic}}"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id)
);

-- Create table for similarity search display configuration
CREATE TABLE IF NOT EXISTS workflow_similarity_configs (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    -- JSON configuration similar to dashboard config
    fields JSON NOT NULL,
    -- Example: [{"name": "Summary", "type": "text", "source": "Summarize Content.executive_summary"}, ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id)
);

-- Create triggers for new tables
CREATE TRIGGER update_workflow_embedding_configs_updated_at 
BEFORE UPDATE ON workflow_embedding_configs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_similarity_configs_updated_at 
BEFORE UPDATE ON workflow_similarity_configs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE workflow_embedding_configs IS 'Stores configuration for generating embeddings from workflow outputs';
COMMENT ON COLUMN workflow_embedding_configs.embedding_template IS 'Template string with placeholders for workflow output values';

COMMENT ON TABLE workflow_similarity_configs IS 'Defines which fields to display in similarity search results';
COMMENT ON COLUMN workflow_similarity_configs.fields IS 'JSON array of field configurations for similarity search display';

EOF < /dev/null
