-- Add embedding_status column to requests table
-- This tracks the status of embedding generation for each request

-- Create the enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE embedding_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add the embedding_status column to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS embedding_status embedding_status DEFAULT 'PENDING';

-- Create an index on embedding_status for faster queries
CREATE INDEX IF NOT EXISTS idx_requests_embedding_status ON requests(embedding_status);

-- Update existing records to have 'COMPLETED' status if they already have embeddings
-- This assumes that existing records have already had their embeddings generated
UPDATE requests 
SET embedding_status = 'COMPLETED' 
WHERE embedding_status = 'PENDING' 
AND created_at < NOW() - INTERVAL '1 minute';