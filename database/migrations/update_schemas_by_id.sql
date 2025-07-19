-- Update workflow blocks with proper output schemas using IDs

-- 17. Classify Topic
UPDATE workflow_blocks 
SET output_schema = '{
  "type": "object",
  "properties": {
    "primary_topic": {
      "type": "string",
      "description": "Primary topic of the request"
    },
    "secondary_topics": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Secondary topics identified"
    },
    "confidence_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confidence score for topic classification"
    }
  },
  "required": ["primary_topic", "secondary_topics", "confidence_score"]
}'
WHERE id = 17;

-- 18. Summarize Request
UPDATE workflow_blocks 
SET output_schema = '{
  "type": "object",
  "properties": {
    "executive_summary": {
      "type": "string",
      "description": "Executive summary of the request"
    },
    "key_points": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Key points from the request"
    },
    "requested_records": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Specific records requested"
    }
  },
  "required": ["executive_summary", "key_points", "requested_records"]
}'
WHERE id = 18;

-- 19. Assess Sensitivity
UPDATE workflow_blocks 
SET output_schema = '{
  "type": "object",
  "properties": {
    "score": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Sensitivity score from 0 to 1"
    },
    "risk_factors": {
      "type": "array",
      "items": {"type": "string"},
      "description": "Identified risk factors"
    },
    "explanation": {
      "type": "string",
      "description": "Explanation of sensitivity assessment"
    }
  },
  "required": ["score", "risk_factors", "explanation"]
}'
WHERE id = 19;

-- 20. Suggest Redactions
UPDATE workflow_blocks 
SET output_schema = '{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "text_span": {
        "type": "string",
        "description": "Text that should be redacted"
      },
      "start_pos": {
        "type": "integer",
        "description": "Starting position of the text span"
      },
      "end_pos": {
        "type": "integer",
        "description": "Ending position of the text span"
      },
      "reason": {
        "type": "string",
        "description": "Reason for redaction"
      },
      "exemption_code": {
        "type": "string",
        "description": "TaskFlow exemption code"
      },
      "confidence": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "Confidence in redaction suggestion"
      }
    },
    "required": ["text_span", "start_pos", "end_pos", "reason", "exemption_code", "confidence"]
  },
  "description": "Array of redaction suggestions"
}'
WHERE id = 20;

-- Update the first one with complete schema
UPDATE workflow_blocks 
SET output_schema = '{
  "type": "object",
  "properties": {
    "word_count": {
      "type": "integer",
      "description": "Number of words in the document"
    },
    "estimated_processing_time": {
      "type": "integer",
      "description": "Estimated processing time in minutes"
    },
    "document_type": {
      "type": "string",
      "description": "Type of document"
    },
    "urgency_level": {
      "type": "string",
      "enum": ["LOW", "MEDIUM", "HIGH"],
      "description": "Urgency level of the request"
    }
  },
  "required": ["word_count", "estimated_processing_time", "document_type", "urgency_level"]
}'
WHERE id = 16;