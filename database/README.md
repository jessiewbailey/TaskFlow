# TaskFlow Database

This directory contains the database schema files and migration scripts for TaskFlow.

## Directory Structure

```
database/
├── README.md                    # This file
├── postgresql/
│   └── init-complete.sql       # Complete PostgreSQL initialization script
├── migrations/                  # SQL migration files
│   ├── 001_create_migration_tracking.sql    # Migration tracking system
│   ├── 002_record_existing_migrations.sql   # Track pre-existing migrations
│   └── [legacy migrations]                  # Historical migration files
└── migrate.py                   # Python migration management tool
```

## 📚 Documentation

All database documentation is located in `/docs/database/`:

- **[Database Overview](/docs/database/README.md)** - Architecture and schema details
- **[Migration Guide](/docs/database/MIGRATION_GUIDE.md)** - Creating and managing migrations
- **[Update Procedures](/docs/database/UPDATE_PROCEDURES.md)** - Database update workflows
- **[Migration Audit](/docs/database/migration-audit-report.md)** - Current migration status

## Quick Reference

### Running Migrations

```bash
# Initialize migration tracking (first time only)
./scripts/db-migrate.sh init

# Run all pending migrations
./scripts/db-migrate.sh migrate

# Check migration status
./scripts/db-migrate.sh status

# Rollback a specific migration
./scripts/db-migrate.sh rollback --version 003_feature_name
```

### Creating New Migrations

1. **Create migration file**:
   ```bash
   touch database/migrations/003_add_new_feature.sql
   ```

2. **Write migration with rollback**:
   ```sql
   -- Add new feature table
   -- Author: Your Name
   -- Date: 2024-12-19
   
   CREATE TABLE new_feature (
       id SERIAL PRIMARY KEY,
       name VARCHAR(255) NOT NULL
   );
   
   -- ROLLBACK:
   -- DROP TABLE IF EXISTS new_feature;
   ```

3. **Apply migration**:
   ```bash
   ./scripts/db-migrate.sh migrate
   ```

For detailed instructions, see the [Migration Guide](/docs/database/MIGRATION_GUIDE.md).

## Primary Database File

### postgresql/init-complete.sql
The complete PostgreSQL initialization script that includes:
- All table definitions
- Indexes and constraints
- Initial data inserts
- All migrations consolidated

**Main tables:**
- `users` - System users with roles
- `requests` - Document processing requests
- `workflows` - AI processing workflows
- `workflow_blocks` - Individual workflow steps
- `ai_outputs` - AI analysis results
- `processing_jobs` - Async job tracking
- `custom_instructions` - Block-specific instructions
- `dashboard_configs` - Dashboard layout configurations
- `exercises` - Exercise definitions
- `system_settings` - System-wide settings

## Migration Files

The `migrations/` directory contains individual migration files for reference and documentation. These migrations are already included in `init-complete.sql` and do not need to be run separately for new deployments.

## Usage

### Local Development
Database initialization is handled automatically by Docker Compose:
```bash
# Schema and migrations are applied on first run
docker-compose up -d postgres
```

### Kubernetes Deployment
Database initialization is handled automatically via Kustomize:
```bash
# The ConfigMap is generated automatically from k8s/base/01-init-complete.sql
# Make sure the file is up to date:
cp database/postgresql/init-complete.sql k8s/base/01-init-complete.sql

# Apply all resources including the generated ConfigMap
kubectl apply -k k8s/base/

# For database initialization job (if needed)
kubectl apply -f k8s/db-init-job.yaml
```

### Manual Database Setup
```bash
# Run the complete initialization script
psql -U taskflow_user -d taskflow_db -f database/postgresql/init-complete.sql
```

## Modifying the Database Schema

### Important: Procedure for Changing the Init Script

When you need to modify the database schema, follow these steps:

1. **Create a Migration File**
   ```bash
   # Create a new migration file in the migrations directory
   touch database/migrations/YYYY-MM-DD-description.sql
   ```

2. **Write the Migration**
   - Include IF NOT EXISTS clauses for safety
   - Add comments explaining the change
   - Test on a local database first

3. **Apply to Existing Deployments**
   ```bash
   # For local development
   docker-compose exec postgres psql -U taskflow_user -d taskflow_db -f /path/to/migration.sql
   
   # For Kubernetes
   kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db < migration.sql
   ```

4. **Update init-complete.sql**
   ```bash
   # Add the migration to the end of init-complete.sql
   cat database/migrations/your-migration.sql >> database/postgresql/init-complete.sql
   ```

5. **Update Kubernetes ConfigMap**
   ```bash
   # Copy the updated init script to k8s directory (required for Kustomize)
   cp database/postgresql/init-complete.sql k8s/base/01-init-complete.sql
   
   # The ConfigMap is now automatically generated by Kustomize
   # To verify the ConfigMap generation:
   cd k8s/base && kubectl kustomize .
   
   # Apply the changes to your cluster
   kubectl apply -k k8s/base/
   ```

6. **Test Fresh Deployment**
   ```bash
   # Test with a fresh database to ensure init script works
   docker-compose down -v
   docker-compose up -d postgres
   ```

### Best Practices

- **Never modify init-complete.sql directly** - Always create a migration first
- **Test migrations thoroughly** before applying to production
- **Keep migrations idempotent** - They should be safe to run multiple times
- **Document breaking changes** in migration comments
- **Version control** all migration files
- **Backup production data** before applying migrations

### Migration Template

```sql
-- Migration: Brief description
-- Date: YYYY-MM-DD
-- Author: Your name
-- Purpose: Detailed explanation of what this migration does

-- Add your SQL statements here
-- Use IF NOT EXISTS, IF EXISTS, etc. for safety

-- Example:
-- ALTER TABLE requests ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);
-- CREATE INDEX IF NOT EXISTS idx_new_field ON requests(new_field);
```

## Backup and Recovery

### Backup
```bash
# Full backup
pg_dump -U taskflow_user taskflow_db > backup-$(date +%Y%m%d-%H%M%S).sql

# Schema only
pg_dump -U taskflow_user --schema-only taskflow_db > schema_backup.sql

# Data only
pg_dump -U taskflow_user --data-only taskflow_db > data_backup.sql
```

### Recovery
```bash
# Restore from backup
psql -U taskflow_user taskflow_db < backup.sql

# For Kubernetes
kubectl cp backup.sql taskflow/postgres-0:/tmp/
kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user taskflow_db < /tmp/backup.sql
```

## Troubleshooting

### Common Issues

1. **Migration Already Applied**
   - Migrations are designed to be idempotent
   - Safe to re-run if you see "already exists" messages

2. **Permission Errors**
   - Ensure taskflow_user has appropriate permissions
   - Check PostgreSQL logs for details

3. **Connection Issues**
   - Verify PostgreSQL is running
   - Check connection parameters in environment variables
   - Ensure network connectivity in Kubernetes

### Useful Commands

```bash
# Check database status
docker-compose exec postgres pg_isready

# View PostgreSQL logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U taskflow_user -d taskflow_db

# List all tables
\dt

# Describe a table
\d table_name

# Check current schema version
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 1;
```