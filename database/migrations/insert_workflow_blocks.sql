USE taskflow_db;

-- Insert workflow blocks for the default workflow (id = 1)
INSERT INTO workflow_blocks (workflow_id, name, prompt, order_index, output_schema) VALUES 
(1, 'Extract Basic Metadata', 'Analyze this TaskFlow request and extract basic metadata:\n\nTaskFlow Request Text:\n{request_text}\n\nProvide a JSON response with this structure:\n{\n    "word_count": 100,\n    "estimated_processing_time": 30,\n    "document_type": "Records Request",\n    "urgency_level": "MEDIUM"\n}', 1, '{"type": "object", "properties": {"word_count": {"type": "integer"}, "estimated_processing_time": {"type": "integer"}, "document_type": {"type": "string"}, "urgency_level": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]}}}'),
(1, 'Classify Topic', 'Classify the topic and subject matter of this TaskFlow request:\n\nTaskFlow Request Text:\n{request_text}\n\nProvide a JSON response with this structure:\n{\n    "primary_topic": "General",\n    "secondary_topics": ["Administrative"],\n    "confidence_score": 0.8\n}', 2, '{"type": "object", "properties": {"primary_topic": {"type": "string"}, "secondary_topics": {"type": "array", "items": {"type": "string"}}, "confidence_score": {"type": "number", "minimum": 0.0, "maximum": 1.0}}}'),
(1, 'Summarize Request', 'Create a comprehensive summary of this TaskFlow request:\n\nTaskFlow Request Text:\n{request_text}\n\nProvide a JSON response with this structure:\n{\n    "executive_summary": "Brief summary of the request",\n    "key_points": ["Key point 1", "Key point 2"],\n    "requested_records": ["Record type 1", "Record type 2"]\n}', 3, '{"type": "object", "properties": {"executive_summary": {"type": "string"}, "key_points": {"type": "array", "items": {"type": "string"}}, "requested_records": {"type": "array", "items": {"type": "string"}}}}'),
(1, 'Assess Sensitivity', 'Assess the sensitivity level of this TaskFlow request:\n\nTaskFlow Request Text:\n{request_text}\n\nTopic Classification:\n{topic_info}\n\nProvide a JSON response with this structure:\n{\n    "score": 0.3,\n    "risk_factors": ["Low risk"],\n    "explanation": "Standard request with minimal sensitivity concerns"\n}', 4, '{"type": "object", "properties": {"score": {"type": "number", "minimum": 0.0, "maximum": 1.0}, "risk_factors": {"type": "array", "items": {"type": "string"}}, "explanation": {"type": "string"}}}'),
(1, 'Suggest Redactions', 'Analyze this TaskFlow request and suggest potential redactions:\n\nTaskFlow Request Text:\n{request_text}\n\nPrevious Analysis:\n- Summary: {summary}\n- Sensitivity Score: {sensitivity_score}\n- Topic: {topic}\n\nProvide a JSON response with this structure:\n{\n    "redaction_suggestions": []\n}', 5, '{"type": "object", "properties": {"redaction_suggestions": {"type": "array", "items": {"type": "object", "properties": {"text_span": {"type": "string"}, "start_pos": {"type": "integer"}, "end_pos": {"type": "integer"}, "reason": {"type": "string"}, "exemption_code": {"type": "string"}, "confidence": {"type": "number", "minimum": 0.0, "maximum": 1.0}}}}}}');

-- Insert block inputs
-- Block 1: Extract Basic Metadata - uses request text
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
(1, 'REQUEST_TEXT', 'request_text');

-- Block 2: Classify Topic - uses request text  
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
(2, 'REQUEST_TEXT', 'request_text');

-- Block 3: Summarize Request - uses request text
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
(3, 'REQUEST_TEXT', 'request_text');

-- Block 4: Assess Sensitivity - uses request text and topic from block 2
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
(4, 'REQUEST_TEXT', 'request_text'),
(4, 'BLOCK_OUTPUT', 'topic_info');

-- Set the source block for topic_info input
UPDATE workflow_block_inputs 
SET source_block_id = 2
WHERE block_id = 4 AND variable_name = 'topic_info';

-- Block 5: Suggest Redactions - uses request text and outputs from previous blocks
INSERT INTO workflow_block_inputs (block_id, input_type, variable_name) VALUES 
(5, 'REQUEST_TEXT', 'request_text'),
(5, 'BLOCK_OUTPUT', 'summary'),
(5, 'BLOCK_OUTPUT', 'sensitivity_score'),
(5, 'BLOCK_OUTPUT', 'topic');

-- Set source blocks for redaction block inputs
UPDATE workflow_block_inputs SET source_block_id = 3 WHERE block_id = 5 AND variable_name = 'summary';
UPDATE workflow_block_inputs SET source_block_id = 4 WHERE block_id = 5 AND variable_name = 'sensitivity_score';
UPDATE workflow_block_inputs SET source_block_id = 2 WHERE block_id = 5 AND variable_name = 'topic';

COMMIT;