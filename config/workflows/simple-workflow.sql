-- Simple Workflow Configuration for TaskFlow
-- A minimal workflow for basic task processing without AI analysis
-- Suitable for simple task management use cases

-- Insert simple workflow
INSERT INTO workflows (name, description, is_default, created_at) VALUES
('Simple Task Management', 'Basic task management workflow without AI processing', false, NOW());

-- Get the workflow ID (assuming it's ID 2 for second workflow)
SET @workflow_id = 2;

-- Insert workflow blocks for the simple workflow
INSERT INTO workflow_blocks (workflow_id, block_type, name, description, config, sort_order, created_at) VALUES
(@workflow_id, 'manual_review', 'Initial Review', 'Review and categorize the task', 
 '{"required": true, "assignable": true, "fields": ["priority", "category", "estimated_effort"]}', 1, NOW()),
 
(@workflow_id, 'manual_review', 'Task Processing', 'Process the task', 
 '{"required": true, "assignable": true, "fields": ["progress_notes", "attachments"]}', 2, NOW()),
 
(@workflow_id, 'approval', 'Mark Complete', 'Mark the task as completed', 
 '{"required": true, "roles": ["ANALYST", "SUPERVISOR", "ADMIN"]}', 3, NOW());

-- Insert dashboard configuration for the simple workflow
INSERT INTO dashboard_configs (workflow_id, config_json, created_at) VALUES
(@workflow_id, '{
  "title": "Simple Task Management Dashboard",
  "description": "Basic task management metrics and overview",
  "widgets": [
    {
      "type": "metric",
      "title": "Total Tasks",
      "query": "SELECT COUNT(*) as value FROM requests WHERE workflow_id = 2",
      "position": {"x": 0, "y": 0, "w": 4, "h": 2}
    },
    {
      "type": "metric",
      "title": "In Progress",
      "query": "SELECT COUNT(*) as value FROM requests WHERE workflow_id = 2 AND status = \"IN_REVIEW\"",
      "position": {"x": 4, "y": 0, "w": 4, "h": 2}
    },
    {
      "type": "metric",
      "title": "Completed",
      "query": "SELECT COUNT(*) as value FROM requests WHERE workflow_id = 2 AND status = \"CLOSED\"",
      "position": {"x": 8, "y": 0, "w": 4, "h": 2}
    },
    {
      "type": "chart",
      "title": "Task Status Distribution",
      "query": "SELECT status as label, COUNT(*) as value FROM requests WHERE workflow_id = 2 GROUP BY status",
      "chartType": "doughnut",
      "position": {"x": 0, "y": 2, "w": 6, "h": 4}
    },
    {
      "type": "table",
      "title": "Active Tasks",
      "query": "SELECT id, LEFT(text, 60) as description, requester, status, created_at FROM requests WHERE workflow_id = 2 AND status != \"CLOSED\" ORDER BY created_at DESC",
      "position": {"x": 6, "y": 2, "w": 6, "h": 4}
    },
    {
      "type": "chart",
      "title": "Tasks by Analyst",
      "query": "SELECT u.name as label, COUNT(*) as value FROM requests r JOIN users u ON r.assigned_analyst_id = u.id WHERE r.workflow_id = 2 GROUP BY u.name ORDER BY value DESC",
      "chartType": "bar",
      "position": {"x": 0, "y": 6, "w": 12, "h": 3}
    }
  ]
}', NOW());