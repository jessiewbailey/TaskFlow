-- Add is_default column to workflows table
ALTER TABLE workflows ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Mark the first workflow as default if it exists
UPDATE workflows SET is_default = TRUE WHERE id = 1;