-- Migration: Add custom_instructions column to processing_jobs
-- Date: 2025-07-31
-- Author: System
-- Purpose: Add missing custom_instructions column that the API expects

-- Add the custom_instructions column to processing_jobs table
ALTER TABLE processing_jobs 
ADD COLUMN IF NOT EXISTS custom_instructions TEXT;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN processing_jobs.custom_instructions IS 'Optional custom instructions for this specific job execution';