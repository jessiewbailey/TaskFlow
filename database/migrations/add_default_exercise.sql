-- Add default_exercise column to exercises table
-- Only one exercise can be marked as default at a time

ALTER TABLE exercises 
ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Create unique partial index to ensure only one default exercise
CREATE UNIQUE INDEX idx_exercises_default ON exercises(is_default) WHERE is_default = TRUE;

-- Update the current "Default Exercise" to be the default
UPDATE exercises 
SET is_default = TRUE 
WHERE name = 'Default Exercise';