-- Add pgvector extension if not already installed
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding_vector column to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS requests_embedding_vector_idx 
ON requests 
USING ivfflat (embedding_vector vector_cosine_ops)
WITH (lists = 100);