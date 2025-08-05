-- Migration Tracking System
-- Author: System
-- Date: 2024-12-19
-- Description: Creates a migration tracking table to manage database schema versions

-- Create schema_migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(50) DEFAULT 'migration', -- 'migration', 'seed', 'rollback'
    checksum VARCHAR(64), -- SHA256 hash of the migration file
    applied_by VARCHAR(255) DEFAULT CURRENT_USER,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    rollback_sql TEXT -- Optional SQL to rollback this migration
);

-- Create index for faster lookups
CREATE INDEX idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Create a function to record migration execution
CREATE OR REPLACE FUNCTION record_migration(
    p_version VARCHAR(255),
    p_description TEXT,
    p_checksum VARCHAR(64),
    p_execution_time_ms INTEGER,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL,
    p_rollback_sql TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO schema_migrations (
        version,
        description,
        checksum,
        execution_time_ms,
        success,
        error_message,
        rollback_sql
    ) VALUES (
        p_version,
        p_description,
        p_checksum,
        p_execution_time_ms,
        p_success,
        p_error_message,
        p_rollback_sql
    )
    ON CONFLICT (version) DO UPDATE
    SET 
        applied_at = CURRENT_TIMESTAMP,
        execution_time_ms = EXCLUDED.execution_time_ms,
        success = EXCLUDED.success,
        error_message = EXCLUDED.error_message,
        applied_by = CURRENT_USER;
END;
$$ LANGUAGE plpgsql;

-- Create a view to show migration status
CREATE OR REPLACE VIEW migration_status AS
SELECT 
    version,
    description,
    type,
    applied_at,
    applied_by,
    execution_time_ms,
    success,
    CASE 
        WHEN error_message IS NOT NULL THEN 'Failed: ' || error_message
        WHEN success THEN 'Applied successfully'
        ELSE 'Unknown status'
    END as status,
    checksum
FROM schema_migrations
ORDER BY applied_at DESC;

-- Add comments
COMMENT ON TABLE schema_migrations IS 'Tracks applied database migrations and their status';
COMMENT ON COLUMN schema_migrations.version IS 'Unique version identifier for the migration (e.g., 001_add_users_table)';
COMMENT ON COLUMN schema_migrations.checksum IS 'SHA256 hash of the migration file to detect changes';
COMMENT ON COLUMN schema_migrations.rollback_sql IS 'Optional SQL to rollback this specific migration';

-- Record this migration
SELECT record_migration(
    '001_create_migration_tracking',
    'Creates migration tracking system',
    'manual_execution',
    0,
    true,
    NULL,
    'DROP VIEW IF EXISTS migration_status; DROP FUNCTION IF EXISTS record_migration(VARCHAR, TEXT, VARCHAR, INTEGER, BOOLEAN, TEXT, TEXT); DROP TABLE IF EXISTS schema_migrations;'
);