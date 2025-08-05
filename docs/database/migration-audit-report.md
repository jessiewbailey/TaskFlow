# Database Migration Audit Report

## Summary
This report compares the database initialization file (`database/postgresql/init-complete.sql`) with migration files to identify any missing updates.

## Current State of init-complete.sql

### Tables Included:
1. **users** - User management
2. **workflows** - Workflow definitions
3. **requests** - Main request tracking (includes embedding_status)
4. **ai_outputs** - AI processing results
5. **processing_jobs** - Job queue (includes custom_instructions, retry_count)
6. **workflow_blocks** - Workflow building blocks
7. **workflow_block_inputs** - Block input configuration
8. **workflow_dashboard_configs** - Dashboard configuration
9. **custom_instructions** - Per-request custom instructions
10. **ground_truth_data** - Fine-tuning data
11. **exercises** - Exercise management (includes is_default)
12. **exercise_permissions** - Exercise access control
13. **system_settings** - Global settings (includes UI visibility settings)
14. **webhooks** - Webhook configuration
15. **webhook_deliveries** - Webhook delivery tracking

### ENUM Types:
- **user_role**: ANALYST, SUPERVISOR, ADMIN
- **request_status**: NEW, IN_REVIEW, PENDING, CLOSED
- **job_status**: PENDING, RUNNING, COMPLETED, FAILED
- **job_type**: STANDARD, CUSTOM, WORKFLOW, EMBEDDING, BULK_EMBEDDING ✓
- **workflow_status**: DRAFT, ACTIVE, ARCHIVED
- **block_type**: CORE, CUSTOM
- **block_input_type**: REQUEST_TEXT, BLOCK_OUTPUT
- **embedding_status**: PENDING, PROCESSING, COMPLETED, FAILED ✓
- **dashboard_layout**: grid, list

## Missing Tables/Migrations

### 1. Workflow Embedding Configuration Tables
**Source**: `backend/migrations/add_workflow_embedding_config_no_vector.sql`
**Missing Tables**:
- `workflow_embedding_configs` - Stores embedding template configuration
- `workflow_similarity_configs` - Stores similarity search display configuration

These tables are required for the embedding and similarity search features but are NOT in the init file.

### 2. Embedding Vector Column
**Source**: `backend/migrations/add_embedding_vector.sql`
**Status**: Unknown - need to check if requests table has embedding_vector column

## Migrations Already Applied in init-complete.sql
✓ Exercises tables and permissions
✓ System settings with UI visibility options
✓ Webhooks and webhook deliveries
✓ Custom instructions for processing jobs
✓ Retry count for processing jobs
✓ EMBEDDING and BULK_EMBEDDING job types
✓ embedding_status column in requests
✓ Removed deprecated ai_outputs columns

## Recommended Actions

1. **Add missing tables to init-complete.sql**:
   - workflow_embedding_configs
   - workflow_similarity_configs
   - Associated triggers and indexes

2. **Verify embedding_vector column**:
   - Check if requests table should have embedding_vector column
   - If yes, add it to init-complete.sql

3. **Create a migration tracking system**:
   - Consider using a migrations table to track applied migrations
   - This would help prevent discrepancies between environments

## Migration Procedures

### Current Process
1. Migrations are stored in two locations:
   - `/database/migrations/` - Main database migrations
   - `/backend/migrations/` - Backend-specific migrations

2. The init-complete.sql file should be the complete schema including all migrations

### Recommended Process
1. Apply all migrations to a test database
2. Generate a schema dump
3. Update init-complete.sql with the complete schema
4. Version control both individual migrations and the complete schema
5. Consider implementing a migration tool (like Flyway or Liquibase) for better tracking

## Conclusion
The init-complete.sql file is mostly up-to-date but missing the workflow embedding configuration tables. These should be added to ensure new deployments have the complete schema.