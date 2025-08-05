#!/bin/bash
# Apply embedding configuration tables migration

set -e

echo "Applying workflow embedding configuration migration..."

kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db << 'EOF'
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

-- Verify tables were created
\dt workflow_*_configs
EOF

echo "Migration completed successfully!"