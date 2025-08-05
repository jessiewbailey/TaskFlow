-- Record existing migrations that were already applied
-- Author: System
-- Date: 2024-12-19
-- Description: Records all previously applied migrations in the tracking system

-- Record all existing migrations that were applied before tracking was implemented
DO $$
BEGIN
    -- Only run if the migrations haven't been recorded yet
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'initial_schema') THEN
        -- Record the initial complete schema
        PERFORM record_migration(
            'initial_schema',
            'Initial TaskFlow database schema including all tables and base data',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        -- Record applied migrations from the migrations directory
        PERFORM record_migration(
            'add_exercises',
            'Add exercises table and permissions system',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_system_settings',
            'Add system settings table for global configuration',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_ui_visibility_settings',
            'Add UI visibility settings to system_settings',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_webhooks',
            'Add webhooks tables for external notifications',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_embedding_status',
            'Add embedding_status column to requests table',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_retry_count_to_jobs',
            'Add retry_count column to processing_jobs',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'update_job_type_enum',
            'Add EMBEDDING and BULK_EMBEDDING to job_type enum',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'remove_deprecated_ai_output_columns',
            'Remove legacy columns from ai_outputs table',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_workflow_embedding_config',
            'Add workflow embedding and similarity configuration tables',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        PERFORM record_migration(
            'add_embedding_vector',
            'Add pgvector extension and embedding_vector column',
            'pre-tracking',
            0,
            true,
            NULL,
            NULL
        );

        RAISE NOTICE 'Recorded % existing migrations', 10;
    ELSE
        RAISE NOTICE 'Existing migrations already recorded';
    END IF;
END $$;