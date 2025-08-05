# Database Deployment Strategy Recommendations

## Current State Analysis

Currently, TaskFlow uses a mixed approach:
1. **init-complete.sql** - A monolithic SQL file with the complete schema
2. **Alembic migrations** - Located in `/backend/alembic/versions/`
3. **Kubernetes ConfigMap** - Uses init-complete.sql for fresh deployments
4. **No automatic migration running** - Migrations must be run manually

## Recommended Approach: Hybrid Strategy

### For Production Environments

#### 1. Keep init-complete.sql as Baseline Schema
- **Purpose**: Fast, reliable fresh deployments
- **When to update**: Only for major version releases (e.g., v1.0, v2.0)
- **Benefits**:
  - Single source of truth for baseline schema
  - No dependency on migration history
  - Faster fresh deployments
  - Easy to audit complete schema

#### 2. Use Migrations for Incremental Changes
- **Purpose**: Safe updates to existing deployments
- **When to use**: All changes between major releases
- **Benefits**:
  - Reversible changes
  - Audit trail
  - Zero-downtime deployments
  - Data preservation

### Implementation Plan

#### Option A: Automatic Migration Runner (Recommended)
Create a Kubernetes Job that runs before API startup:

```yaml
# k8s/base/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  template:
    spec:
      restartPolicy: Never
      initContainers:
        - name: wait-for-db
          image: busybox:1.35
          command: ['sh', '-c', 'until nc -z postgres 5432; do sleep 1; done']
      containers:
        - name: migrate
          image: registry.digitalocean.com/simplerequest/taskflow-api:latest
          command: ["alembic", "upgrade", "head"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: taskflow-secrets
                  key: database-url
```

Update the backend Dockerfile:
```dockerfile
# Copy alembic files
COPY alembic.ini .
COPY alembic/ ./alembic/
```

#### Option B: Init Container Approach
Add to the API deployment:

```yaml
# k8s/base/api-deployment.yaml
spec:
  template:
    spec:
      initContainers:
        - name: db-migrate
          image: registry.digitalocean.com/simplerequest/taskflow-api:latest
          command: ["alembic", "upgrade", "head"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: taskflow-secrets
                  key: database-url
```

### Deployment Workflow

#### Fresh Deployment
1. PostgreSQL starts with init-complete.sql
2. Migration job runs (marks all migrations as applied)
3. API starts

#### Update Deployment
1. New migration files added to codebase
2. Deploy new image
3. Migration job/init container runs new migrations
4. API starts with updated schema

### Best Practices

1. **Version Control**
   ```sql
   -- At the top of init-complete.sql
   -- Schema Version: 1.0.0
   -- Last Updated: 2025-08-05
   -- Includes migrations up to: add_workflow_configs_001
   ```

2. **Migration Naming**
   ```
   YYYYMMDD_HHMMSS_descriptive_name.py
   Example: 20250805_130000_add_workflow_embedding_configs.py
   ```

3. **Testing Strategy**
   - Test migrations against a copy of production data
   - Always include both `upgrade()` and `downgrade()`
   - Test rollback procedures

4. **Documentation**
   ```python
   """Add workflow embedding configuration tables

   This migration adds tables for storing workflow-specific
   embedding generation and similarity display configurations.
   
   Related Issue: #123
   Breaking Changes: None
   """
   ```

### Migration Script

Create this helper script:

```bash
#!/bin/bash
# scripts/db-migrate.sh

set -e

ACTION=${1:-status}

case $ACTION in
  status)
    echo "Current migration status:"
    kubectl exec -n taskflow deployment/taskflow-api -- alembic current
    ;;
  
  upgrade)
    echo "Running migrations..."
    kubectl exec -n taskflow deployment/taskflow-api -- alembic upgrade head
    ;;
  
  history)
    echo "Migration history:"
    kubectl exec -n taskflow deployment/taskflow-api -- alembic history
    ;;
  
  create)
    NAME=${2:-"new_migration"}
    echo "Creating new migration: $NAME"
    kubectl exec -n taskflow deployment/taskflow-api -- alembic revision -m "$NAME"
    ;;
  
  *)
    echo "Usage: $0 {status|upgrade|history|create [name]}"
    exit 1
    ;;
esac
```

### Periodic Consolidation

Every major release:
1. Update init-complete.sql with all migrations
2. Create a new baseline migration
3. Archive old migrations
4. Update documentation

### Example Release Process

```bash
# 1. Tag the schema version
git tag schema-v1.0.0

# 2. Generate consolidated schema
pg_dump --schema-only taskflow_db > database/postgresql/init-complete-v1.0.0.sql

# 3. Create baseline migration
alembic revision -m "baseline_v1_0_0" --version-path alembic/versions/baselines/

# 4. Update init-complete.sql
cp database/postgresql/init-complete-v1.0.0.sql database/postgresql/init-complete.sql

# 5. Document the baseline
echo "-- Baseline includes all migrations up to: $(date +%Y%m%d)" >> database/postgresql/init-complete.sql
```

## Recommendation Summary

1. **Use init-complete.sql for fresh deployments** - Keep it updated at major releases
2. **Use Alembic for incremental changes** - All changes between releases
3. **Automate migration running** - Use Kubernetes Job or init container
4. **Document schema versions** - Track which migrations are included
5. **Test both paths** - Fresh deploys and upgrades

This approach provides:
- Fast, reliable fresh deployments
- Safe incremental updates
- Clear upgrade paths
- Rollback capability
- Good documentation trail