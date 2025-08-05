# TaskFlow Database Migration Guide

## Overview
TaskFlow now includes a comprehensive migration tracking system that records all database schema changes and provides rollback capabilities.

## Quick Start

### 1. Initialize Migration Tracking (First Time Only)
```bash
# Using the wrapper script
./scripts/db-migrate.sh init

# Or with environment variables
PGPASSWORD=yourpassword ./scripts/db-migrate.sh init
```

### 2. Run Pending Migrations
```bash
# Run all pending migrations
./scripts/db-migrate.sh migrate

# Run up to a specific version
./scripts/db-migrate.sh migrate --version 003_add_user_preferences
```

### 3. Check Migration Status
```bash
./scripts/db-migrate.sh status
```

### 4. Rollback a Migration
```bash
./scripts/db-migrate.sh rollback --version 005_add_complex_feature
```

## Migration File Structure

### Naming Convention
```
NNN_descriptive_name.sql
```
- `NNN` - Three-digit sequence number (001, 002, etc.)
- `descriptive_name` - Clear description of the change

### Migration Template
```sql
-- Short description of the migration
-- Author: Your Name
-- Date: 2024-12-19
-- Description: Detailed explanation of what this migration does

-- Main migration SQL
CREATE TABLE new_feature (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ROLLBACK:
-- DROP TABLE IF EXISTS new_feature;
```

### Including Rollback SQL
Add rollback commands in comments after `-- ROLLBACK:`:
```sql
-- Add new column
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';

-- ROLLBACK:
-- ALTER TABLE users DROP COLUMN IF EXISTS preferences;
```

## Creating New Migrations

### 1. Create Migration File
```bash
# Create in main migrations directory
touch database/migrations/002_add_user_preferences.sql

# Or in backend-specific directory
touch backend/migrations/003_add_api_keys.sql
```

### 2. Write Migration
```sql
-- Add user preferences column
-- Author: John Doe
-- Date: 2024-12-19
-- Description: Adds JSONB column for storing user preferences

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_users_preferences 
ON users USING GIN (preferences);

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_users_preferences;
-- ALTER TABLE users DROP COLUMN IF EXISTS preferences;
```

### 3. Test Migration
```bash
# Test on development database
DB_NAME=taskflow_dev ./scripts/db-migrate.sh migrate

# Verify changes
psql -U postgres -d taskflow_dev -c "\d users"
```

### 4. Update init-complete.sql
After testing, add the changes to `database/postgresql/init-complete.sql` for new installations.

## Migration Tracking System

### Schema Migrations Table
The system creates a `schema_migrations` table that tracks:
- `version` - Unique migration identifier
- `description` - What the migration does
- `checksum` - SHA256 hash to detect file changes
- `applied_at` - When it was applied
- `applied_by` - Database user who ran it
- `execution_time_ms` - How long it took
- `success` - Whether it succeeded
- `error_message` - Error details if failed
- `rollback_sql` - SQL to undo the migration

### Migration Status View
Query the `migration_status` view for a readable summary:
```sql
SELECT * FROM migration_status ORDER BY applied_at DESC;
```

## Environment Configuration

### Using Environment Variables
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=taskflow_db
export DB_USER=postgres
export PGPASSWORD=secret

./scripts/db-migrate.sh migrate
```

### Using Command Line Arguments
```bash
./scripts/db-migrate.sh migrate \
  --host localhost \
  --port 5432 \
  --database taskflow_db \
  --user postgres \
  --password secret
```

## Best Practices

### 1. Always Include Rollback SQL
Even if it's just a comment explaining why rollback isn't possible:
```sql
-- Create complex view with dependencies
CREATE VIEW complex_analysis AS ...;

-- ROLLBACK:
-- Cannot rollback - manually drop view and dependent objects:
-- DROP VIEW complex_analysis CASCADE;
```

### 2. Make Migrations Idempotent
Use `IF NOT EXISTS` and `IF EXISTS` clauses:
```sql
CREATE TABLE IF NOT EXISTS new_table (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_column TYPE;
DROP INDEX IF EXISTS old_index;
```

### 3. Test Rollbacks
Before deploying, test that rollback works:
```bash
# Apply migration
./scripts/db-migrate.sh migrate --version 005_new_feature

# Test rollback
./scripts/db-migrate.sh rollback --version 005_new_feature

# Re-apply if successful
./scripts/db-migrate.sh migrate --version 005_new_feature
```

### 4. Keep Migrations Small
One logical change per migration file. This makes rollbacks easier.

### 5. Document Complex Changes
```sql
-- Migration: Refactor user roles to support multi-tenancy
-- Author: Jane Smith
-- Date: 2024-12-19
-- 
-- This migration:
-- 1. Creates new role_assignments table
-- 2. Migrates data from users.role column
-- 3. Drops the old column
-- 
-- Note: This requires application code changes in version 2.0
```

## Troubleshooting

### Migration Fails Partially
The system uses transactions, so partial failures are rolled back automatically.

### Checksum Mismatch
If you modify a migration file after applying it:
1. Rollback the migration first
2. Make your changes
3. Re-apply the migration

### Lost Rollback SQL
Check the `schema_migrations` table:
```sql
SELECT rollback_sql 
FROM schema_migrations 
WHERE version = 'NNN_migration_name';
```

### Manual Rollback
If automated rollback fails:
```sql
-- Start transaction
BEGIN;

-- Run rollback SQL manually
DROP TABLE problem_table;

-- Update tracking
UPDATE schema_migrations 
SET success = false, 
    type = 'rollback',
    applied_at = CURRENT_TIMESTAMP
WHERE version = 'NNN_migration_name';

-- Commit if successful
COMMIT;
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Run Database Migrations
  env:
    PGPASSWORD: ${{ secrets.DB_PASSWORD }}
  run: |
    ./scripts/db-migrate.sh migrate
    ./scripts/db-migrate.sh status
```

### Kubernetes Job
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: taskflow-backend:latest
        command: ["/app/scripts/db-migrate.sh", "migrate"]
        env:
        - name: DB_HOST
          value: postgres-service
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
```

## Migration History

Track all migrations in version control. Current migrations:
- `001_create_migration_tracking` - Migration system itself
- All existing migrations now tracked in the system

## Future Enhancements

1. **Automatic Checksum Validation** - Detect modified migrations
2. **Dry Run Mode** - Preview changes without applying
3. **Migration Dependencies** - Specify order requirements
4. **Data Migrations** - Support for data transformation migrations
5. **Parallel Migrations** - Run independent migrations concurrently