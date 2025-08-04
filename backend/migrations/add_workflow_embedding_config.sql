-- Add embedding configuration to workflows

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

-- Add embedding vector column to requests table if not exists
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Add index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_requests_embedding_vector 
ON requests USING ivfflat (embedding_vector vector_cosine_ops);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflow_embedding_configs_updated_at 
BEFORE UPDATE ON workflow_embedding_configs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_similarity_configs_updated_at 
BEFORE UPDATE ON workflow_similarity_configs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();