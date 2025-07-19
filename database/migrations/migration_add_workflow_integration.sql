-- Migration: Add workflow integration fields
-- This adds the missing columns to integrate workflows with requests

USE taskflow_db;

-- Add default flag to workflows table
ALTER TABLE workflows ADD COLUMN is_default BOOLEAN DEFAULT FALSE NOT NULL;

-- Add workflow_id to requests table
ALTER TABLE requests ADD COLUMN workflow_id BIGINT;
ALTER TABLE requests ADD CONSTRAINT fk_requests_workflow 
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL;

-- Add workflow support to processing jobs
ALTER TABLE processing_jobs ADD COLUMN workflow_id BIGINT;
ALTER TABLE processing_jobs ADD CONSTRAINT fk_processing_jobs_workflow 
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL;

-- Add new job type for workflow processing
ALTER TABLE processing_jobs MODIFY COLUMN job_type ENUM('STANDARD','CUSTOM','WORKFLOW') DEFAULT 'STANDARD';

-- Create indexes for better performance
CREATE INDEX idx_requests_workflow ON requests(workflow_id);
CREATE INDEX idx_processing_jobs_workflow ON processing_jobs(workflow_id);

-- Insert default workflow that mirrors the current hardcoded pipeline
INSERT INTO workflows (name, description, status, is_default, created_by) VALUES 
('Standard Request Processing', 'Default 5-step request analysis pipeline', 'ACTIVE', TRUE, 1);

SET @workflow_id = LAST_INSERT_ID();

-- Insert workflow blocks that match the current hardcoded pipeline
INSERT INTO workflow_blocks (workflow_id, name, prompt, order_index, output_schema) VALUES 
(
    @workflow_id, 
    'Extract Basic Metadata', 
    'Analyze this request and extract basic metadata:\n\nRequest Text:\n{request_text}\n\nProvide a JSON response with this structure:\n{\n    "word_count": <number>,\n    "estimated_processing_time": <minutes>,\n    "document_type": "<string describing the type of request>",\n    "urgency_level": "<LOW|MEDIUM|HIGH>"\n}\n\nConsider factors like complexity, scope, and legal requirements when estimating processing time.',
    1,
    '{"type": "object", "properties": {"word_count": {"type": "integer"}, "estimated_processing_time": {"type": "integer"}, "document_type": {"type": "string"}, "urgency_level": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]}}}'
),
(
    @workflow_id,
    'Classify Topic',
    'Classify the topic and subject matter of this request:\n\nRequest Text:\n{request_text}\n\nProvide a JSON response with this structure:\n{\n    "primary_topic": "<main subject area>",\n    "secondary_topics": ["<topic1>", "<topic2>"],\n    "confidence_score": <float between 0.0 and 1.0>\n}\n\nCommon topics include: Law Enforcement, National Security, Healthcare, Environmental, Financial, Immigration, etc.',
    2,
    '{"type": "object", "properties": {"primary_topic": {"type": "string"}, "secondary_topics": {"type": "array", "items": {"type": "string"}}, "confidence_score": {"type": "number", "minimum": 0.0, "maximum": 1.0}}}'
),
(
    @workflow_id,
    'Summarize Request',
    'Create a comprehensive summary of this request:\n\nRequest Text:\n{request_text}\n\n{custom_instructions}\n\nProvide a JSON response with this structure:\n{\n    "executive_summary": "<2-3 sentence overview>",\n    "key_points": ["<point1>", "<point2>", "<point3>"],\n    "requested_records": ["<record type 1>", "<record type 2>"]\n}\n\nFocus on what specific records or information the requester is seeking.',
    3,
    '{"type": "object", "properties": {"executive_summary": {"type": "string"}, "key_points": {"type": "array", "items": {"type": "string"}}, "requested_records": {"type": "array", "items": {"type": "string"}}}}'
),
(
    @workflow_id,
    'Assess Sensitivity',
    'Assess the sensitivity level of this request based on the topic classification:\n\nRequest Text:\n{request_text}\n\nTopic Classification:\n{topic_info}\n\nProvide a JSON response with this structure:\n{\n    "score": <float between 0.0 and 1.0>,\n    "risk_factors": ["<factor1>", "<factor2>"],\n    "explanation": "<brief explanation of the score>"\n}\n\nConsider factors like national security implications, personal privacy, law enforcement sensitivity, etc.',
    4,
    '{"type": "object", "properties": {"score": {"type": "number", "minimum": 0.0, "maximum": 1.0}, "risk_factors": {"type": "array", "items": {"type": "string"}}, "explanation": {"type": "string"}}}'
),
(
    @workflow_id,
    'Suggest Redactions',
    'Analyze this request and suggest potential redactions based on common exemptions:\n\nRequest Text:\n{request_text}\n\nPrevious Analysis:\n- Summary: {summary}\n- Sensitivity Score: {sensitivity_score}\n- Topic: {topic}\n\n{custom_instructions}\n\nIdentify text spans that might need redaction and provide a JSON response:\n{\n    "redaction_suggestions": [\n        {\n            "text_span": "<exact text that might need redaction>",\n            "start_pos": <character position>,\n            "end_pos": <character position>,\n            "reason": "<explanation>",\n            "exemption_code": "<TaskFlow exemption code like b(1), b(6), etc>",\n            "confidence": <float between 0.0 and 1.0>\n        }\n    ]\n}\n\nCommon exemptions:\n- (b)(1): National defense/foreign policy\n- (b)(2): Internal agency rules\n- (b)(3): Statutory exemptions\n- (b)(4): Trade secrets\n- (b)(5): Deliberative process\n- (b)(6): Personal privacy\n- (b)(7): Law enforcement records',
    5,
    '{"type": "object", "properties": {"redaction_suggestions": {"type": "array", "items": {"type": "object", "properties": {"text_span": {"type": "string"}, "start_pos": {"type": "integer"}, "end_pos": {"type": "integer"}, "reason": {"type": "string"}, "exemption_code": {"type": "string"}, "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0}}}}}}'
);

-- Add block inputs for the workflow
-- Block 1: Extract Basic Metadata - uses request text
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 1), 'REQUEST_TEXT', 'request_text');

-- Block 2: Classify Topic - uses request text
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 2), 'REQUEST_TEXT', 'request_text');

-- Block 3: Summarize Request - uses request text
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 3), 'REQUEST_TEXT', 'request_text');

-- Block 4: Assess Sensitivity - uses request text and topic from block 2
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 4), 'REQUEST_TEXT', 'request_text'),
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 4), 'BLOCK_OUTPUT', 'topic_info');

-- Set the source block for topic_info input
UPDATE workflow_block_inputs 
SET source_block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 2)
WHERE block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 4) 
AND variable_name = 'topic_info';

-- Block 5: Suggest Redactions - uses request text and outputs from previous blocks
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5), 'REQUEST_TEXT', 'request_text'),
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5), 'BLOCK_OUTPUT', 'summary'),
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5), 'BLOCK_OUTPUT', 'sensitivity_score'),
((SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5), 'BLOCK_OUTPUT', 'topic');

-- Set source blocks for redaction block inputs
UPDATE workflow_block_inputs 
SET source_block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 3)
WHERE block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5) 
AND variable_name = 'summary';

UPDATE workflow_block_inputs 
SET source_block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 4)
WHERE block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5) 
AND variable_name = 'sensitivity_score';

UPDATE workflow_block_inputs 
SET source_block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 2)
WHERE block_id = (SELECT id FROM workflow_blocks WHERE workflow_id = @workflow_id AND order_index = 5) 
AND variable_name = 'topic';

COMMIT;