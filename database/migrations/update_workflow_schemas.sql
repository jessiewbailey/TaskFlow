-- Update workflow blocks with proper output schemas based on the current AI processing pipeline

-- 1. Extract Basic Metadata
UPDATE workflow_blocks 
SET output_schema = JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
        'word_count', JSON_OBJECT('type', 'integer', 'description', 'Number of words in the document'),
        'estimated_processing_time', JSON_OBJECT('type', 'integer', 'description', 'Estimated processing time in minutes'),
        'document_type', JSON_OBJECT('type', 'string', 'description', 'Type of document'),
        'urgency_level', JSON_OBJECT('type', 'string', 'enum', JSON_ARRAY('LOW', 'MEDIUM', 'HIGH'), 'description', 'Urgency level of the request')
    ),
    'required', JSON_ARRAY('word_count', 'estimated_processing_time', 'document_type', 'urgency_level')
)
WHERE name = 'Extract Basic Metadata';

-- 2. Classify Topic
UPDATE workflow_blocks 
SET output_schema = JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
        'primary_topic', JSON_OBJECT('type', 'string', 'description', 'Primary topic of the request'),
        'secondary_topics', JSON_OBJECT('type', 'array', 'items', JSON_OBJECT('type', 'string'), 'description', 'Secondary topics identified'),
        'confidence_score', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 1, 'description', 'Confidence score for topic classification')
    ),
    'required', JSON_ARRAY('primary_topic', 'secondary_topics', 'confidence_score')
)
WHERE name = 'Classify Topic';

-- 3. Summarize Request
UPDATE workflow_blocks 
SET output_schema = JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
        'executive_summary', JSON_OBJECT('type', 'string', 'description', 'Executive summary of the request'),
        'key_points', JSON_OBJECT('type', 'array', 'items', JSON_OBJECT('type', 'string'), 'description', 'Key points from the request'),
        'requested_records', JSON_OBJECT('type', 'array', 'items', JSON_OBJECT('type', 'string'), 'description', 'Specific records requested')
    ),
    'required', JSON_ARRAY('executive_summary', 'key_points', 'requested_records')
)
WHERE name = 'Summarize Request';

-- 4. Assess Sensitivity
UPDATE workflow_blocks 
SET output_schema = JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
        'score', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 1, 'description', 'Sensitivity score from 0 to 1'),
        'risk_factors', JSON_OBJECT('type', 'array', 'items', JSON_OBJECT('type', 'string'), 'description', 'Identified risk factors'),
        'explanation', JSON_OBJECT('type', 'string', 'description', 'Explanation of sensitivity assessment')
    ),
    'required', JSON_ARRAY('score', 'risk_factors', 'explanation')
)
WHERE name = 'Assess Sensitivity';

-- 5. Suggest Redactions
UPDATE workflow_blocks 
SET output_schema = JSON_OBJECT(
    'type', 'array',
    'items', JSON_OBJECT(
        'type', 'object',
        'properties', JSON_OBJECT(
            'text_span', JSON_OBJECT('type', 'string', 'description', 'Text that should be redacted'),
            'start_pos', JSON_OBJECT('type', 'integer', 'description', 'Starting position of the text span'),
            'end_pos', JSON_OBJECT('type', 'integer', 'description', 'Ending position of the text span'),
            'reason', JSON_OBJECT('type', 'string', 'description', 'Reason for redaction'),
            'exemption_code', JSON_OBJECT('type', 'string', 'description', 'TaskFlow exemption code'),
            'confidence', JSON_OBJECT('type', 'number', 'minimum', 0, 'maximum', 1, 'description', 'Confidence in redaction suggestion')
        ),
        'required', JSON_ARRAY('text_span', 'start_pos', 'end_pos', 'reason', 'exemption_code', 'confidence')
    ),
    'description', 'Array of redaction suggestions'
)
WHERE name = 'Suggest Redactions';