# PostgreSQL Migration Plan for TaskFlow

## Overview
This document outlines the migration plan from MySQL 8.0 to PostgreSQL 15+ for the TaskFlow application.

## Reasons for Migration
1. **Better JSON Support**: PostgreSQL's JSONB type provides superior performance and querying capabilities for our JSON columns
2. **Advanced Features**: Full-text search, arrays, better query optimization
3. **Future ML Capabilities**: pg_vector extension for embeddings and semantic search
4. **Better Concurrency**: Superior MVCC implementation for high-concurrency scenarios
5. **Data Integrity**: Transactional DDL and stricter ACID compliance

## Migration Components

### 1. Database Schema Changes
- **JSON columns**: Convert from MySQL JSON to PostgreSQL JSONB
- **AUTO_INCREMENT**: Change to SERIAL/BIGSERIAL or IDENTITY columns
- **ENUM types**: PostgreSQL has native ENUM support (better than MySQL)
- **Timestamps**: Use PostgreSQL's timestamp with time zone
- **Indexes**: Leverage PostgreSQL's advanced indexing (GIN for JSONB)

### 2. Application Changes
- **Connection strings**: Update DATABASE_URL format
- **Drivers**: 
  - Backend: Change from `aiomysql` to `asyncpg`
  - SQLAlchemy dialect: Change from `mysql+aiomysql` to `postgresql+asyncpg`
- **SQL syntax**: Minor adjustments for PostgreSQL compatibility

### 3. Infrastructure Changes
- **Docker**: Replace MySQL container with PostgreSQL
- **Kubernetes**: Update StatefulSet and init jobs
- **Backups**: Adjust backup strategies for PostgreSQL

### 4. Data Migration Strategy
- Use `pgloader` for initial data migration
- Create migration scripts for any data transformations
- Plan for minimal downtime migration

## Migration Steps

### Phase 1: Development Environment Setup
1. Create PostgreSQL versions of all database scripts
2. Update docker-compose.yml with PostgreSQL service
3. Test application with PostgreSQL locally

### Phase 2: Schema Conversion
1. Convert MySQL DDL to PostgreSQL
2. Optimize schema for PostgreSQL features
3. Add PostgreSQL-specific indexes and constraints

### Phase 3: Application Updates
1. Update Python dependencies
2. Modify connection strings and configurations
3. Test all database operations

### Phase 4: Data Migration Testing
1. Set up pgloader configuration
2. Test data migration with sample data
3. Verify data integrity post-migration

### Phase 5: Production Migration
1. Schedule maintenance window
2. Backup MySQL database
3. Run migration process
4. Verify application functionality
5. Monitor performance

## Rollback Plan
1. Keep MySQL instance running in read-only mode
2. Maintain connection string switch capability
3. Document rollback procedures

## Timeline
- Development and Testing: 2-3 days
- Production Migration: 1-2 hours maintenance window

## Risk Mitigation
1. Extensive testing in development environment
2. Data validation scripts
3. Performance benchmarking
4. Gradual rollout if possible
## Migration Script Usage

### Prerequisites
```bash
cd database/postgresql
pip install -r migration-requirements.txt
```

### Running the Migration
```bash
# Set environment variables
export MYSQL_HOST=localhost
export MYSQL_USER=taskflow_user
export MYSQL_PASSWORD=taskflow_password
export MYSQL_DATABASE=taskflow_db

export POSTGRES_HOST=localhost
export POSTGRES_USER=taskflow_user
export POSTGRES_PASSWORD=taskflow_password
export POSTGRES_DB=taskflow_db

# Run migration
python migrate-mysql-to-postgres.py
```

### Docker Compose Migration
```bash
# Start both databases
docker-compose up -d mysql postgres

# Run migration in container
docker run --rm --network taskflow_default \
  -e MYSQL_HOST=mysql \
  -e POSTGRES_HOST=postgres \
  -v $(pwd)/database/postgresql:/scripts \
  python:3.11-alpine \
  sh -c "pip install -r /scripts/migration-requirements.txt && python /scripts/migrate-mysql-to-postgres.py"
```

## Files Changed

### Removed Files
- `/k8s/base/mysql-statefulset.yaml`
- `/k8s/base/db-init-job.yaml`
- MySQL service from `/k8s/base/services.yaml`

### Added Files
- `/database/postgresql/init-complete.sql` - PostgreSQL schema
- `/database/postgresql/migrate-mysql-to-postgres.py` - Migration script
- `/database/postgresql/migration-requirements.txt` - Migration dependencies
- `/k8s/base/postgres-statefulset.yaml` - PostgreSQL StatefulSet
- `/k8s/base/db-init-job-postgres.yaml` - PostgreSQL init ConfigMap
- `/k8s/base/postgres-init-job.yaml` - PostgreSQL init Job

### Modified Files
- `/docker-compose.yml` - Changed from MySQL to PostgreSQL
- `/.env.example` - Updated DATABASE_URL
- `/backend/requirements.txt` - Changed from aiomysql to asyncpg
- `/k8s/base/secrets-template.yaml` - Updated to PostgreSQL
- `/k8s/base/kustomization.yaml` - Updated resources
- `/k8s/base/api-deployment.yaml` - Updated DATABASE_URL

## Implementation Status
✅ Phase 1: Planning and Analysis - Completed
✅ Phase 2: Schema Conversion - Completed
✅ Phase 3: Application Code Updates - Completed
✅ Phase 4: Migration Script - Completed
⏳ Phase 5: Testing and Validation - Pending
EOF < /dev/null
