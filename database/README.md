# Database Structure

This directory contains all database-related files for TaskFlow.

## Directory Structure

```
database/
├── README.md                    # This file
├── setup/
│   └── schema.sql              # Main database schema
└── migrations/
    ├── add_block_type.sql      # Add block type enumeration
    ├── add_dashboard_config.sql # Add dashboard configuration
    ├── add_is_default.sql      # Add default workflow flag
    ├── final_schemas.sql       # Final schema updates
    ├── insert_workflow_blocks.sql # Insert workflow block data
    ├── migration-custom-instructions.sql # Custom instructions table
    ├── migration_add_model_to_workflow_blocks.sql # Add model field
    ├── migration_add_workflow_integration.sql # Workflow integration
    ├── update_schemas_by_id.sql # Schema updates by ID
    ├── update_schemas_simple.sql # Simple schema updates
    └── update_workflow_schemas.sql # Workflow schema updates
```

## Setup Files

### schema.sql
The main database schema defining all tables, indexes, and constraints. This should be run first when setting up a new database.

**Main tables:**
- `users` - System users with roles
- `requests` - Document processing requests
- `workflows` - AI processing workflows
- `workflow_blocks` - Individual workflow steps
- `ai_outputs` - AI analysis results
- `processing_jobs` - Async job tracking
- `custom_instructions` - Block-specific instructions
- `dashboard_configs` - Dashboard layout configurations

## Migration Files

Migration files are organized chronologically and should be applied in order. Each migration is idempotent and can be safely re-run.

### Key Migrations
1. **workflow_integration** - Links requests to workflows
2. **model_to_workflow_blocks** - Adds AI model selection per block
3. **custom_instructions** - Enables block-specific prompts
4. **dashboard_config** - Adds dashboard customization
5. **block_type** - Adds workflow block type enumeration

## Usage

### Local Development
Database initialization is handled automatically by Docker Compose:
```bash
# Schema and migrations are applied on first run
docker-compose up -d mysql
```

### Kubernetes Deployment
Database initialization is handled by the `db-init-job`:
```bash
# Schema and migrations are embedded in ConfigMaps
kubectl apply -f k8s/db-init-job.yaml
```

### Manual Database Setup
```bash
# Run schema
mysql -u root -p < database/setup/schema.sql

# Run migrations in order
mysql -u root -p < database/migrations/migration_add_workflow_integration.sql
mysql -u root -p < database/migrations/migration_add_model_to_workflow_blocks.sql
# ... continue with other migrations
```

## Development

### Adding New Migrations
1. Create a new SQL file in `migrations/` with descriptive name
2. Include IF NOT EXISTS clauses for safety
3. Add appropriate comments explaining the change
4. Test on a copy of production data
5. Update Kubernetes ConfigMaps if needed

### Schema Changes
- Always use migrations for schema changes
- Never modify `schema.sql` directly in production
- Test migrations on development environment first
- Document breaking changes in migration comments

## Backup and Recovery

### Backup
```bash
# Full backup
mysqldump -u root -p taskflow_db > backup.sql

# Schema only
mysqldump -u root -p --no-data taskflow_db > schema_backup.sql
```

### Recovery
```bash
# Restore from backup
mysql -u root -p taskflow_db < backup.sql
```