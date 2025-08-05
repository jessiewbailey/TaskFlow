-- Missing components to add to init-complete.sql
-- This patch brings the initialization file up to date with all migrations

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

-- Note: workflow_embedding_configs and workflow_similarity_configs tables 
-- are now included in the main init-complete.sql file