-- Database initialization script for TaskFlow workflows
-- This script should be run after the main schema.sql to set up default workflows
-- It will be executed automatically during container startup

-- Default Workflow Configuration for TaskFlow
-- This file contains the default workflow setup for new installations
-- Modify these workflows to match your specific business process

-- Insert default workflow
INSERT INTO workflows (name, description, is_default, created_by, created_at) VALUES
('Default Task Processing', 'Standard task processing workflow with AI analysis', true, 1, NOW());

-- Get the workflow ID for the blocks (assuming it's ID 1 for first install)
SET @workflow_id = 1;

-- Insert workflow blocks for the default workflow
INSERT INTO workflow_blocks (workflow_id, block_type, name, prompt, order_index, output_schema, created_at) VALUES
(@workflow_id, 'CORE', 'Extract Metadata', 'Extract basic metadata from the task text including dates, names, and key information.', 1, '{"prompt_type": "extract_metadata", "required": true}', NOW()),
 
(@workflow_id, 'CORE', 'Classify Topic', 'Classify the topic and subject matter of the request.', 2, '{"prompt_type": "classify_topic", "required": true}', NOW()),
 
(@workflow_id, 'CORE', 'Summarize Content', 'Create a comprehensive summary of the request content.', 3, '{"prompt_type": "summarize_request", "required": true}', NOW()),
 
(@workflow_id, 'CORE', 'Assess Sensitivity', 'Evaluate sensitivity and risk factors for this request.', 4, '{"prompt_type": "sensitivity_score", "required": true}', NOW()),
 
(@workflow_id, 'CUSTOM', 'Suggest Actions', 'Provide recommendations for next steps and actions.', 5, '{"prompt_type": "suggest_redactions", "required": false}', NOW());

-- Insert dashboard configuration for the default workflow
INSERT INTO workflow_dashboard_configs (workflow_id, fields, created_at) VALUES
(@workflow_id, '{"title": "Task Processing Dashboard", "description": "Overview of task processing metrics"}', NOW());

-- Simple Workflow Configuration for TaskFlow
-- A minimal workflow for basic task processing without AI analysis
-- Suitable for simple task management use cases

-- Insert simple workflow
INSERT INTO workflows (name, description, is_default, created_by, created_at) VALUES
('Simple Task Management', 'Basic task management workflow without AI processing', false, 1, NOW());

-- Get the workflow ID (assuming it's ID 2 for second workflow)
SET @workflow_id = 2;

-- Insert workflow blocks for the simple workflow
INSERT INTO workflow_blocks (workflow_id, block_type, name, prompt, order_index, output_schema, created_at) VALUES
(@workflow_id, 'CUSTOM', 'Initial Review', 'Review and categorize the task appropriately.', 1, '{"required": true, "assignable": true, "fields": ["priority", "category", "estimated_effort"]}', NOW()),
 
(@workflow_id, 'CUSTOM', 'Task Processing', 'Process the task according to requirements.', 2, '{"required": true, "assignable": true, "fields": ["progress_notes", "attachments"]}', NOW()),
 
(@workflow_id, 'CUSTOM', 'Mark Complete', 'Mark the task as completed after verification.', 3, '{"required": true, "roles": ["ANALYST", "SUPERVISOR", "ADMIN"]}', NOW());

-- Insert dashboard configuration for the simple workflow
INSERT INTO workflow_dashboard_configs (workflow_id, fields, created_at) VALUES
(@workflow_id, '{"title": "Simple Task Management Dashboard", "description": "Basic task management metrics"}', NOW());

-- Create default admin user if not exists
INSERT IGNORE INTO users (name, email, role, created_at) VALUES
('System Administrator', 'admin@taskflow.local', 'ADMIN', NOW());

-- Create default analyst user if not exists  
INSERT IGNORE INTO users (name, email, role, created_at) VALUES
('Default Analyst', 'analyst@taskflow.local', 'ANALYST', NOW());

-- Insert sample task for testing (optional - remove in production)
INSERT INTO requests (text, requester, workflow_id, status, created_at) VALUES
('This is a sample task for testing the TaskFlow system. It demonstrates how tasks are processed through the workflow system.', 
 'System Setup', 1, 'NEW', NOW());

-- Update the sample task with default AI analysis (optional - remove in production)
INSERT INTO ai_outputs (request_id, summary, topic, sensitivity_score, custom_instructions, created_at) VALUES
(1, 'Sample task for system testing and demonstration', 'System Testing', 0.1, 'This is a test task for initial system setup', NOW());