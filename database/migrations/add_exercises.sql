-- Add exercises feature to TaskFlow
-- An exercise is a way to organize tasks and control access

-- Create exercises table
CREATE TABLE exercises (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active exercises sorted by name
CREATE INDEX idx_exercises_active_name ON exercises(is_active, name);

-- Add exercise_id to requests table
ALTER TABLE requests 
ADD COLUMN exercise_id BIGINT REFERENCES exercises(id) ON DELETE SET NULL;

-- Create index for request exercise filtering
CREATE INDEX idx_requests_exercise ON requests(exercise_id);

-- Create exercise permissions table for future access control
CREATE TABLE exercise_permissions (
    id BIGSERIAL PRIMARY KEY,
    exercise_id BIGINT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(32) NOT NULL DEFAULT 'read', -- 'read', 'write', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exercise_id, user_id)
);

-- Create indexes for exercise permissions
CREATE INDEX idx_exercise_permissions_user ON exercise_permissions(user_id);
CREATE INDEX idx_exercise_permissions_exercise ON exercise_permissions(exercise_id);

-- Add trigger to update exercises.updated_at
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a default exercise
INSERT INTO exercises (name, description, created_by) 
VALUES ('Default Exercise', 'Default exercise for all tasks', 1);

-- Update existing requests to use the default exercise
UPDATE requests 
SET exercise_id = (SELECT id FROM exercises WHERE name = 'Default Exercise')
WHERE exercise_id IS NULL;