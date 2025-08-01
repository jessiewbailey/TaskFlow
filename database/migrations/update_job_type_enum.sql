-- Add new job types to the job_type enum
-- This is required for async embedding processing

-- PostgreSQL doesn't allow direct ALTER TYPE ADD VALUE in a transaction
-- So we need to use a different approach

-- Add EMBEDDING job type
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'EMBEDDING';

-- Add BULK_EMBEDDING job type  
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'BULK_EMBEDDING';