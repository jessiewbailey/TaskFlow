-- Add retry_count column to processing_jobs table
-- This tracks how many times a job has been retried

ALTER TABLE processing_jobs 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Create an index on retry_count for queries that filter by retry attempts
CREATE INDEX IF NOT EXISTS idx_processing_jobs_retry_count ON processing_jobs(retry_count);