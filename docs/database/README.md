# TaskFlow Database

This directory contains all database-related files for the TaskFlow application.

## Directory Structure

```
database/
├── postgresql/
│   ├── init-complete.sql      # Complete schema for new installations
│   └── init-complete-patch.sql # Recent patches (temporary file)
├── migrations/                 # Incremental schema changes
│   ├── 001_create_migration_tracking.sql
│   ├── 002_record_existing_migrations.sql
│   └── ...
├── migrate.py                  # Python migration tool
├── DATABASE_UPDATE_PROCEDURES.md # Detailed update procedures
├── MIGRATION_GUIDE.md          # Comprehensive migration guide
├── migration-audit-report.md   # Audit of current migration status
└── README.md                   # This file
```

## Quick Start

### New Installation

For a fresh database setup:

```bash
# Create database
createdb -U postgres taskflow_db

# Apply complete schema
psql -U postgres -d taskflow_db < database/postgresql/init-complete.sql
```

### Existing Installation

For updating an existing database:

```bash
# Initialize migration tracking (first time only)
./scripts/db-migrate.sh init

# Run pending migrations
./scripts/db-migrate.sh migrate

# Check status
./scripts/db-migrate.sh status
```

## Migration System

TaskFlow uses a comprehensive migration tracking system that:

- **Tracks** all applied migrations with checksums
- **Records** execution time and success status
- **Supports** rollback functionality
- **Maintains** a complete audit trail

### Key Features

1. **Automatic Tracking** - Every migration is recorded in `schema_migrations` table
2. **Rollback Support** - Include rollback SQL in migration files
3. **Checksum Validation** - Detects if migration files are modified
4. **Status Reporting** - View migration history and status
5. **Idempotent** - Migrations can be run multiple times safely

### Creating Migrations

1. Create a new SQL file in `database/migrations/`:
   ```bash
   touch database/migrations/003_add_new_feature.sql
   ```

2. Write your migration with rollback commands:
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

3. Apply the migration:
   ```bash
   ./scripts/db-migrate.sh migrate
   ```

## Important Files

### init-complete.sql
The complete database schema for new installations. This file should always represent the current state of the database including all migrations.

### Migration Files
Individual SQL files in the `migrations/` directory that represent incremental changes. Named with pattern: `NNN_description.sql`

### migrate.py
Python tool that manages migration execution, tracking, and rollback.

## Database Schema

### Core Tables
- `users` - User management
- `workflows` - Workflow definitions
- `requests` - Task requests
- `ai_outputs` - AI processing results
- `processing_jobs` - Job queue
- `exercises` - Exercise organization
- `webhooks` - External notifications

### Configuration Tables
- `system_settings` - Global settings
- `workflow_blocks` - Workflow components
- `workflow_dashboard_configs` - Dashboard layouts
- `workflow_embedding_configs` - Embedding configuration
- `workflow_similarity_configs` - Similarity search config

### Tracking Tables
- `schema_migrations` - Migration history
- `ground_truth_data` - Training data
- `custom_instructions` - Per-request customization

## Best Practices

1. **Always test migrations** on a development database first
2. **Include rollback SQL** in every migration
3. **Keep migrations small** - one logical change per file
4. **Update init-complete.sql** after migrations are stable
5. **Use IF EXISTS** clauses for idempotent migrations

## Troubleshooting

### Common Issues

1. **Migration fails**: Check error in `schema_migrations` table
2. **Checksum mismatch**: Don't modify applied migrations
3. **Missing permissions**: Ensure database user has CREATE privileges
4. **Connection issues**: Check database credentials and network

### Getting Help

- Check `MIGRATION_GUIDE.md` for detailed instructions
- Review `DATABASE_UPDATE_PROCEDURES.md` for deployment procedures
- Check migration status: `./scripts/db-migrate.sh status`
- View logs in `schema_migrations` table

## Future Improvements

- [ ] Add dry-run mode for migrations
- [ ] Implement automatic backups before migrations
- [ ] Add migration dependency management
- [ ] Create web UI for migration management
- [ ] Add support for data migrations