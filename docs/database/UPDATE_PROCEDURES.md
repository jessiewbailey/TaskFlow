# Database Update Procedures

## Overview
This document outlines the procedures for managing database schema changes in TaskFlow.

## Directory Structure
```
TaskFlow/
├── database/
│   ├── postgresql/
│   │   └── init-complete.sql      # Complete schema for new installations
│   └── migrations/                 # General database migrations
└── backend/
    └── migrations/                 # Backend-specific migrations
```

## Migration Naming Convention
- Use descriptive names: `add_<feature>.sql` or `update_<table>_<change>.sql`
- Include date in filename if needed: `2024_01_15_add_feature.sql`
- Keep migrations atomic - one logical change per file

## Development Workflow

### 1. Creating a New Migration
```bash
# Create migration file in appropriate directory
touch database/migrations/add_new_feature.sql

# Add migration SQL
echo "-- Description of change
-- Author: Your Name
-- Date: $(date +%Y-%m-%d)

ALTER TABLE ... ADD COLUMN ...;" > database/migrations/add_new_feature.sql
```

### 2. Testing Migration
```bash
# Test on local database
psql -U postgres -d taskflow_dev < database/migrations/add_new_feature.sql

# Verify changes
psql -U postgres -d taskflow_dev -c "\d+ table_name"
```

### 3. Updating init-complete.sql
After testing, update the initialization file:

```bash
# Option 1: Manual update
# Edit database/postgresql/init-complete.sql to include new changes

# Option 2: Generate from existing database
pg_dump -U postgres -d taskflow_dev --schema-only --no-owner --no-privileges > database/postgresql/init-complete-new.sql

# Review and merge changes
diff database/postgresql/init-complete.sql database/postgresql/init-complete-new.sql
```

## Deployment Procedures

### For Existing Installations

1. **Backup Database**
   ```bash
   pg_dump -U postgres -d taskflow_prod > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply Migrations**
   ```bash
   # Apply individual migrations in order
   psql -U postgres -d taskflow_prod < database/migrations/migration_file.sql
   ```

3. **Verify Changes**
   ```bash
   # Check schema
   psql -U postgres -d taskflow_prod -c "\dt"
   psql -U postgres -d taskflow_prod -c "\d+ modified_table"
   ```

### For New Installations

1. **Use init-complete.sql**
   ```bash
   # Create database
   createdb -U postgres taskflow_prod
   
   # Apply complete schema
   psql -U postgres -d taskflow_prod < database/postgresql/init-complete.sql
   ```

## Kubernetes Deployment

1. **Update ConfigMap**
   ```bash
   # Generate new ConfigMap
   kubectl create configmap postgres-init \
     --from-file=01-init-complete.sql=database/postgresql/init-complete.sql \
     --dry-run=client -o yaml > k8s/base/postgres-init-configmap.yaml
   ```

2. **Apply Changes**
   ```bash
   kubectl apply -f k8s/base/postgres-init-configmap.yaml
   
   # For existing deployments, run migrations manually
   kubectl exec -it postgres-pod -- psql -U postgres -d taskflow < migration.sql
   ```

## Best Practices

1. **Always Backup** before applying migrations to production
2. **Test Migrations** on a copy of production data
3. **Keep init-complete.sql Updated** after each migration
4. **Document Changes** in migration files with comments
5. **Version Control** all migration files
6. **Review Changes** before applying to production

## Migration Checklist

- [ ] Migration file created in correct directory
- [ ] Migration tested on local database
- [ ] init-complete.sql updated with changes
- [ ] Migration documented with author, date, and purpose
- [ ] Rollback script prepared (if applicable)
- [ ] Backup taken before production deployment
- [ ] Changes verified after deployment

## Rollback Procedures

1. **Prepare Rollback Script**
   ```sql
   -- Example rollback for adding a column
   ALTER TABLE table_name DROP COLUMN IF EXISTS new_column;
   ```

2. **Test Rollback**
   ```bash
   # Test on development
   psql -U postgres -d taskflow_dev < rollback_script.sql
   ```

3. **Execute if Needed**
   ```bash
   # Restore from backup or run rollback script
   psql -U postgres -d taskflow_prod < rollback_script.sql
   ```

## Common Issues and Solutions

### Issue: Migration Already Applied
**Solution**: Use `IF NOT EXISTS` clauses
```sql
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name TYPE;
```

### Issue: Enum Type Already Exists
**Solution**: Check before creating
```sql
DO $$ BEGIN
    CREATE TYPE status_type AS ENUM ('active', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

### Issue: Foreign Key Conflicts
**Solution**: Defer constraint checking
```sql
BEGIN;
SET CONSTRAINTS ALL DEFERRED;
-- Run migrations
COMMIT;
```

## Monitoring

After deployment:
1. Check application logs for database errors
2. Monitor query performance
3. Verify data integrity
4. Test affected features

## Contact

For database migration assistance:
- Check existing migrations in `database/migrations/`
- Review this document
- Test thoroughly in development first