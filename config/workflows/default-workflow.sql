-- Default Workflow Configuration for TaskFlow
-- This file contains the default workflow setup for new installations
-- Modify these workflows to match your specific business process

-- Insert default workflow
INSERT INTO workflows (name, description, is_default, created_at) VALUES
('Default Task Processing', 'Standard task processing workflow with AI analysis', true, NOW());

-- Get the workflow ID for the blocks (assuming it's ID 1 for first install)
SET @workflow_id = 1;

-- Insert workflow blocks for the default workflow
INSERT INTO workflow_blocks (workflow_id, name, prompt, order_index, block_type, output_schema) VALUES
(@workflow_id, 'Extract Metadata', 
 'You are an AI assistant analyzing task requests. Extract basic metadata from the following request text. Return your response as JSON with the following structure:
{
  "request_type": "string describing the type of request",
  "urgency": "LOW|MEDIUM|HIGH",
  "estimated_complexity": "SIMPLE|MODERATE|COMPLEX",
  "keywords": ["list", "of", "relevant", "keywords"],
  "entities": {
    "people": ["person names if any"],
    "organizations": ["organization names if any"],
    "dates": ["date references if any"],
    "locations": ["location references if any"]
  }
}

Request text: {request_text}', 
 1, 'CORE', 
 '{"type": "object", "properties": {"request_type": {"type": "string"}, "urgency": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]}, "estimated_complexity": {"type": "string", "enum": ["SIMPLE", "MODERATE", "COMPLEX"]}, "keywords": {"type": "array", "items": {"type": "string"}}, "entities": {"type": "object", "properties": {"people": {"type": "array", "items": {"type": "string"}}, "organizations": {"type": "array", "items": {"type": "string"}}, "dates": {"type": "array", "items": {"type": "string"}}, "locations": {"type": "array", "items": {"type": "string"}}}}}}'),
 
(@workflow_id, 'Classify Topic', 
 'You are an AI assistant analyzing task requests. Classify the topic and subject matter of the following request. Return your response as JSON with the following structure:
{
  "primary_topic": "main topic category",
  "secondary_topics": ["list", "of", "related", "topics"],
  "subject_area": "broad subject area",
  "confidence_score": 0.95
}

Request text: {request_text}', 
 2, 'CORE',
 '{"type": "object", "properties": {"primary_topic": {"type": "string"}, "secondary_topics": {"type": "array", "items": {"type": "string"}}, "subject_area": {"type": "string"}, "confidence_score": {"type": "number", "minimum": 0, "maximum": 1}}}'),
 
(@workflow_id, 'Summarize Content', 
 'You are an AI assistant analyzing task requests. Create a comprehensive summary of the following request. Return your response as JSON with the following structure:
{
  "summary": "concise summary of the request",
  "key_points": ["list", "of", "key", "points"],
  "requirements": ["specific", "requirements", "or", "deliverables"],
  "timeline_mentions": ["any", "time", "references"],
  "priority_indicators": ["indicators", "of", "priority", "or", "urgency"]
}

Request text: {request_text}', 
 3, 'CORE',
 '{"type": "object", "properties": {"summary": {"type": "string"}, "key_points": {"type": "array", "items": {"type": "string"}}, "requirements": {"type": "array", "items": {"type": "string"}}, "timeline_mentions": {"type": "array", "items": {"type": "string"}}, "priority_indicators": {"type": "array", "items": {"type": "string"}}}}'),
 
(@workflow_id, 'Assess Sensitivity', 
 'You are an AI assistant analyzing task requests for sensitivity and risk factors. Based on the request text and topic classification, assess the sensitivity level. Return your response as JSON with the following structure:
{
  "score": 0.5,
  "level": "LOW|MEDIUM|HIGH",
  "risk_factors": ["list", "of", "identified", "risks"],
  "privacy_concerns": ["privacy", "related", "concerns"],
  "handling_recommendations": ["recommended", "handling", "procedures"]
}

Request text: {request_text}
Topic info: {topic_info}', 
 4, 'CORE',
 '{"type": "object", "properties": {"score": {"type": "number", "minimum": 0, "maximum": 1}, "level": {"type": "string", "enum": ["LOW", "MEDIUM", "HIGH"]}, "risk_factors": {"type": "array", "items": {"type": "string"}}, "privacy_concerns": {"type": "array", "items": {"type": "string"}}, "handling_recommendations": {"type": "array", "items": {"type": "string"}}}}'),
 
(@workflow_id, 'Suggest Actions', 
 'You are an AI assistant providing recommendations for task processing. Based on the request analysis, provide actionable recommendations. Return your response as JSON with the following structure:
{
  "redaction_suggestions": ["areas", "that", "may", "need", "redaction"],
  "processing_recommendations": ["recommended", "processing", "steps"],
  "review_requirements": ["areas", "requiring", "human", "review"],
  "next_steps": ["suggested", "next", "actions"],
  "estimated_timeline": "time estimate for completion"
}

Request text: {request_text}
Summary: {summary}
Sensitivity score: {sensitivity_score}
Topic: {topic}', 
 5, 'CORE',
 '{"type": "object", "properties": {"redaction_suggestions": {"type": "array", "items": {"type": "string"}}, "processing_recommendations": {"type": "array", "items": {"type": "string"}}, "review_requirements": {"type": "array", "items": {"type": "string"}}, "next_steps": {"type": "array", "items": {"type": "string"}}, "estimated_timeline": {"type": "string"}}}');

-- Insert dashboard configuration for the default workflow
INSERT INTO workflow_dashboard_configs (workflow_id, fields, layout) VALUES
(@workflow_id, 
 '[
    {
      "type": "metric",
      "title": "Total Tasks",
      "query": "SELECT COUNT(*) as value FROM requests",
      "position": {"x": 0, "y": 0, "w": 3, "h": 2}
    },
    {
      "type": "metric", 
      "title": "Pending Tasks",
      "query": "SELECT COUNT(*) as value FROM requests WHERE status IN (\"NEW\", \"IN_REVIEW\")",
      "position": {"x": 3, "y": 0, "w": 3, "h": 2}
    },
    {
      "type": "metric",
      "title": "Completed This Week", 
      "query": "SELECT COUNT(*) as value FROM requests WHERE status = \"CLOSED\" AND updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
      "position": {"x": 6, "y": 0, "w": 3, "h": 2}
    },
    {
      "type": "chart",
      "title": "Tasks by Status",
      "query": "SELECT status as label, COUNT(*) as value FROM requests GROUP BY status",
      "chartType": "pie",
      "position": {"x": 0, "y": 2, "w": 6, "h": 4}
    },
    {
      "type": "table",
      "title": "Recent Tasks",
      "query": "SELECT id, LEFT(text, 50) as description, requester, status, created_at FROM requests ORDER BY created_at DESC LIMIT 10",
      "position": {"x": 6, "y": 2, "w": 6, "h": 4}
    }
  ]',
 'grid');