# MySQL Database Migration Guide for External-Ollama Deployment

This guide explains how to configure your external-ollama TaskFlow deployment to use an existing MySQL database and provides detailed migration instructions.

## Overview

When deploying TaskFlow with external Ollama, you can also configure it to use an existing MySQL database instead of deploying a new MySQL instance. This is beneficial when:

- You have an existing MySQL server with sufficient resources
- You want centralized database management
- You need to share data with other applications
- You have existing backup and maintenance procedures

## Prerequisites

- Existing MySQL 8.0+ server
- Database admin access to create schemas and users
- Network connectivity between Kubernetes cluster and MySQL server
- TaskFlow external-ollama deployment configuration

## Migration Steps

### Step 1: Prepare Your Existing MySQL Database

#### 1.1 Create TaskFlow Database and User

Connect to your MySQL server and run:

```sql
-- Create the TaskFlow database
CREATE DATABASE IF NOT EXISTS taskflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a dedicated user for TaskFlow
CREATE USER 'taskflow_user'@'%' IDENTIFIED BY 'your_secure_password';

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON taskflow_db.* TO 'taskflow_user'@'%';
FLUSH PRIVILEGES;
```

#### 1.2 Apply TaskFlow Schema

**IMPORTANT**: TaskFlow includes a database initialization job (`taskflow-db-init`) that automatically sets up the complete schema and applies all necessary migrations. This job is the **recommended** way to initialize your database.

##### Option A: Use TaskFlow Database Initialization Job (Recommended)

The TaskFlow deployment includes a Kubernetes job that automatically initializes the database with the complete schema and all migrations. This job:

1. Waits for MySQL to be ready
2. Creates the complete schema from `k8s/base/db-init-job.yaml`
3. Applies all required migrations automatically
4. Sets up default users and workflows

**To use the initialization job with external MySQL:**

```bash
# 1. First, ensure your external MySQL is accessible as 'mysql-service'
# 2. Deploy TaskFlow - the job will run automatically
kubectl apply -k k8s/overlays/external-ollama/

# 3. Monitor the initialization job
kubectl get jobs -n llm | grep taskflow-db-init
kubectl logs -l job-name=taskflow-db-init -n llm -f

# 4. Verify completion
kubectl get job taskflow-db-init -n llm
```

The job executes these scripts in order:
1. **Base Schema**: Complete table creation with indexes and foreign keys
2. **Migration**: `migration_add_workflow_integration.sql` - Workflow integration
3. **Migration**: `migration_add_model_to_workflow_blocks.sql` - Model specification
4. **Migration**: `migration-custom-instructions.sql` - Custom instructions table

##### Option B: Manual Schema Setup (Alternative)

If you prefer to set up the schema manually or need to understand the exact structure:

```bash
# Extract the SQL from the Kubernetes job ConfigMap
kubectl get configmap db-init-scripts -n llm -o yaml > db-init-scripts.yaml

# Or use the initialization file directly:
# 1. Base schema and initial data (creates all tables with latest structure)
mysql -h your-mysql-server -u taskflow_user -p taskflow_db < database/init-complete-fixed.sql

# 2. Apply additional migrations if needed
mysql -h your-mysql-server -u taskflow_user -p taskflow_db < database/migrations/migration_add_workflow_integration.sql
mysql -h your-mysql-server -u taskflow_user -p taskflow_db < database/migrations/migration_add_model_to_workflow_blocks.sql
mysql -h your-mysql-server -u taskflow_user -p taskflow_db < database/migrations/migration-custom-instructions.sql
```

**Note**: The database initialization job in `k8s/base/db-init-job.yaml` contains the most up-to-date schema and is the authoritative source for database structure.

#### 1.3 Verify Schema Installation

```sql
-- Check that all tables are created
USE taskflow_db;
SHOW TABLES;

-- Verify sample data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM workflows;
SELECT COUNT(*) FROM workflow_blocks;
```

Expected tables:
- `users`
- `workflows` 
- `workflow_blocks`
- `workflow_block_inputs`
- `workflow_dashboard_configs`
- `requests`
- `ai_outputs`
- `processing_jobs`

### Step 2: Configure External MySQL in TaskFlow

#### 2.1 Understanding the Database Initialization Job

TaskFlow includes a critical database initialization job (`taskflow-db-init`) that:

- **Automatically waits** for MySQL to be ready before proceeding
- **Creates the complete database schema** with all tables, indexes, and relationships  
- **Applies all migrations** in the correct order
- **Populates default data** including users and workflows
- **Handles idempotent operations** (safe to run multiple times)

**Job Configuration** (`k8s/base/db-init-job.yaml`):
```yaml
# The job connects to MySQL using:
# - Host: mysql (service name)
# - User: root (using MYSQL_ROOT_PASSWORD from secrets)
# - Database: Will create 'taskflow_db' if it doesn't exist

# Job includes these scripts:
# 1. schema.sql - Complete database schema
# 2. migration_add_workflow_integration.sql
# 3. migration_add_model_to_workflow_blocks.sql  
# 4. migration-custom-instructions.sql
```

**For External MySQL**: The job will automatically use your external MySQL if you configure the service correctly. The job connects to the hostname `mysql`, so your external MySQL must be accessible via this service name.

#### 2.2 Update Deployment Configuration

Edit `k8s/overlays/external-ollama/deployment-config-patch.yaml`:

```yaml
# Patch to ensure external Ollama deployment mode
apiVersion: v1
kind: ConfigMap
metadata:
  name: taskflow-deployment-config
  namespace: llm
data:
  OLLAMA_DEPLOYMENT_MODE: "external"
  AUTO_PULL_MODELS: "false"
  
  # Enable external MySQL
  MYSQL_DEPLOYMENT_MODE: "external"  # Change from "internal" to "external"
  
  # External MySQL Settings
  EXTERNAL_MYSQL_HOST: "mysql-service"  # Your MySQL service name
  EXTERNAL_MYSQL_PORT: "3306"
  EXTERNAL_MYSQL_DATABASE: "taskflow_db"
  EXTERNAL_MYSQL_USER: "taskflow_user"
  EXTERNAL_MYSQL_CONNECTION_TYPE: "service"
```

#### 2.2 Update Kubernetes Secrets

Create or update your secrets to include the external MySQL password:

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: taskflow-env
  namespace: llm
type: Opaque
stringData:
  # External MySQL credentials
  MYSQL_PASSWORD: "your_secure_password"
  MYSQL_ROOT_PASSWORD: "your_mysql_root_password"  # if needed for migrations
  MYSQL_DATABASE: "taskflow_db"
  MYSQL_USER: "taskflow_user"
  
  # Update DATABASE_URL to point to external MySQL
  DATABASE_URL: "mysql+aiomysql://taskflow_user:your_secure_password@mysql-service:3306/taskflow_db"
  
  # Your other secrets...
  OLLAMA_HOST: "http://your-ollama-server:11434"
```

### Step 3: Deploy TaskFlow with External MySQL

#### 3.1 Deployment Procedure

**Important**: The database initialization job is critical for proper setup. Follow this exact sequence:

```bash
# 1. Deploy TaskFlow configuration (this creates the namespace and base config)
kubectl apply -k k8s/overlays/external-ollama/

# 2. IMMEDIATELY monitor the database initialization job
kubectl get jobs -n llm -w

# 3. Watch the job logs in real-time (run this in another terminal)
kubectl logs -l job-name=taskflow-db-init -n llm -f

# 4. The job should show these stages:
# - "Waiting for MySQL to be ready..."
# - "MySQL is ready. Initializing database schema..."  
# - "Database initialization completed successfully!"
```

#### 3.2 Database Initialization Job Monitoring

**Critical**: The `taskflow-db-init` job must complete successfully before other components can function.

```bash
# Check job status
kubectl get job taskflow-db-init -n llm
# STATUS should show "Complete" (1/1)

# If job fails, check logs for errors
kubectl logs job/taskflow-db-init -n llm

# Common job issues and solutions:
```

**Job Success Indicators**:
- Job status shows "Complete (1/1)"
- Logs end with "Database initialization completed successfully!"
- No error messages in job logs

**Job Failure Troubleshooting**:
```bash
# If job fails, delete and retry
kubectl delete job taskflow-db-init -n llm
kubectl apply -k k8s/overlays/external-ollama/

# Check job pod for detailed errors
kubectl get pods -n llm | grep taskflow-db-init
kubectl logs <pod-name> -n llm

# Common failure causes:
# 1. MySQL not accessible at 'mysql-service'  
# 2. Incorrect MYSQL_ROOT_PASSWORD in secrets
# 3. Network connectivity issues
# 4. MySQL not ready/running
```

#### 3.3 Verify Deployment Components

```bash
# Check that MySQL StatefulSet is NOT created (since using external)
kubectl get statefulset -n llm | grep mysql
# Should return no results

# Check that external MySQL service is created  
kubectl get svc -n llm | grep mysql
# Should show mysql-external service pointing to mysql-service

# Verify job completed successfully
kubectl get job taskflow-db-init -n llm
# Should show "COMPLETIONS: 1/1" and "AGE: <time>"

# Check that API pods can connect to database
kubectl logs -l app=taskflow-api -n llm | grep -i "database\|mysql"
# Should show successful database connections
```

### Step 4: Test the Migration

#### 4.1 Verify Database Connectivity

```bash
# Test from API pod
kubectl exec -it deployment/taskflow-api -n llm -- /bin/bash
# Inside the pod, test database connection:
python -c "
import asyncio
import aiomysql
async def test():
    conn = await aiomysql.connect(
        host='mysql-service',
        port=3306,
        user='taskflow_user',
        password='your_secure_password',
        db='taskflow_db'
    )
    cursor = await conn.cursor()
    await cursor.execute('SELECT COUNT(*) FROM users')
    result = await cursor.fetchone()
    print(f'Users count: {result[0]}')
    await conn.ensure_closed()
asyncio.run(test())
"
```

#### 4.2 Test TaskFlow Functionality

1. Access TaskFlow UI
2. Create a new request
3. Process it through a workflow
4. Verify data appears in your external MySQL database

### Step 5: Data Migration (If Moving from Internal MySQL)

If you're migrating from an existing TaskFlow deployment with internal MySQL:

#### 5.1 Export Data from Internal MySQL

```bash
# Create a backup of your current TaskFlow data
kubectl exec -it statefulset/mysql -n llm -- mysqldump -u root -p taskflow_db > taskflow_backup.sql
```

#### 5.2 Import Data to External MySQL

```bash
# Import your data to the external MySQL server
mysql -h your-mysql-server -u taskflow_user -p taskflow_db < taskflow_backup.sql
```

#### 5.3 Verify Data Migration

```sql
-- Connect to external MySQL and verify data
USE taskflow_db;
SELECT COUNT(*) FROM requests;
SELECT COUNT(*) FROM ai_outputs;
SELECT COUNT(*) FROM processing_jobs;
-- Compare counts with your backup
```

## Database Schema Reference

### Core Tables

| Table | Purpose | Key Relationships |
|-------|---------|------------------|
| `users` | System users (analysts, supervisors, admins) | Referenced by requests, workflows |
| `workflows` | Workflow definitions | Has many workflow_blocks |
| `workflow_blocks` | Individual workflow steps | Belongs to workflow |
| `requests` | User requests/tasks | Has ai_outputs, processing_jobs |
| `ai_outputs` | AI processing results | Belongs to request |
| `processing_jobs` | Async job tracking | Belongs to request |

### Recent Schema Changes

#### Migration: `add_is_default.sql`
- Added `is_default` column to `workflows` table
- Allows marking workflows as default for new requests

#### Migration: `add_block_type.sql`
- Added `block_type` column to `workflow_blocks` table
- Distinguishes between 'CORE' and 'CUSTOM' workflow blocks

#### Migration: `add_dashboard_config.sql`
- Added `workflow_dashboard_configs` table
- Stores dashboard configuration for each workflow

#### Migration: `migration_add_workflow_integration.sql`
- Enhanced workflow processing capabilities
- Added workflow integration fields

#### Migration: `migration_add_model_to_workflow_blocks.sql`
- Added model specification to workflow blocks
- Allows different AI models per workflow step

#### Migration: `migration-custom-instructions.sql`
- Enhanced custom instructions handling
- Improved AI processing flexibility

## Troubleshooting

### Common Issues

#### 1. Connection Refused
```bash
# Check if MySQL service is accessible
kubectl run mysql-test --image=mysql:8.0 --rm -it -- mysql -h mysql-service -u taskflow_user -p
```

#### 2. Authentication Failed
- Verify username/password in secrets
- Check user permissions in MySQL
- Ensure user can connect from cluster IPs

#### 3. Database Not Found
```sql
-- Verify database exists
SHOW DATABASES LIKE 'taskflow_db';
-- Check character set
SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME 
FROM information_schema.SCHEMATA 
WHERE SCHEMA_NAME = 'taskflow_db';
```

#### 4. Missing Tables
```sql
-- Check if all required tables exist
SELECT TABLE_NAME FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'taskflow_db' 
ORDER BY TABLE_NAME;
```

### Logs to Check

```bash
# API deployment logs
kubectl logs -l app=taskflow-api -n llm --tail=100

# Database initialization job logs (if running)
kubectl logs -l job-name=taskflow-db-init -n llm

# Check events for MySQL connectivity issues
kubectl get events -n llm --sort-by=.metadata.creationTimestamp
```

## Security Considerations

### Database Security
- Use strong passwords for MySQL users
- Limit network access to MySQL server
- Enable SSL/TLS encryption for database connections
- Regular security updates for MySQL server
- Implement proper backup and recovery procedures

### Kubernetes Security
- Store sensitive data in Kubernetes secrets
- Use RBAC to limit access to secrets
- Consider using external secret management (HashiCorp Vault, etc.)
- Network policies to restrict pod-to-pod communication

### Connection Security
```yaml
# Example SSL configuration in mysql-external-config.yaml
data:
  EXTERNAL_MYSQL_SSL_MODE: "REQUIRED"
  EXTERNAL_MYSQL_SSL_CA: "/path/to/ca-cert.pem"
  EXTERNAL_MYSQL_SSL_CERT: "/path/to/client-cert.pem"
  EXTERNAL_MYSQL_SSL_KEY: "/path/to/client-key.pem"
```

## Performance Optimization

### MySQL Configuration
```sql
-- Recommended MySQL settings for TaskFlow
SET GLOBAL innodb_buffer_pool_size = 1073741824;  -- 1GB
SET GLOBAL innodb_log_file_size = 268435456;       -- 256MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
SET GLOBAL max_connections = 200;
```

### Connection Pooling
The TaskFlow API uses connection pooling. Monitor connection usage:
```sql
-- Check current connections
SHOW PROCESSLIST;
-- Check connection statistics
SHOW STATUS LIKE 'Connections';
SHOW STATUS LIKE 'Max_used_connections';
```

## Backup and Recovery

### Database Backup
```bash
# Create regular backups
mysqldump -h your-mysql-server -u taskflow_user -p \
  --single-transaction --routines --triggers \
  taskflow_db > taskflow_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Point-in-Time Recovery
```bash
# Enable binary logging in MySQL for point-in-time recovery
# Add to MySQL configuration:
# log-bin=mysql-bin
# binlog-format=ROW
# expire-logs-days=7
```

## Monitoring

### Key Metrics to Monitor
- Database connection count
- Query performance
- Storage usage
- Backup completion status
- TaskFlow API database connectivity

### Health Checks
```sql
-- Database health check query
SELECT 
  'TaskFlow Database Health' as status,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN status = 'NEW' THEN 1 END) as new_requests,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_requests
FROM requests
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

## Quick Reference: Database Initialization Job

### Job Overview
- **Name**: `taskflow-db-init`
- **Namespace**: `llm`
- **Image**: `mysql:8.0`
- **Purpose**: Automated database schema setup and migration

### Key Commands
```bash
# Monitor job status
kubectl get job taskflow-db-init -n llm

# View job logs
kubectl logs job/taskflow-db-init -n llm

# Watch job progress
kubectl logs -l job-name=taskflow-db-init -n llm -f

# Restart job if failed
kubectl delete job taskflow-db-init -n llm
kubectl apply -k k8s/overlays/external-ollama/

# Extract job SQL scripts for manual review
kubectl get configmap db-init-scripts -n llm -o yaml
```

### Job Dependencies
- **External MySQL** accessible as `mysql-service`
- **Secrets** containing `MYSQL_ROOT_PASSWORD`
- **Network connectivity** from Kubernetes to MySQL
- **MySQL 8.0+** with CREATE/ALTER privileges

### Success Criteria
1. Job status: `COMPLETIONS: 1/1`
2. Log message: `"Database initialization completed successfully!"`
3. All tables created in `taskflow_db` database
4. Default users and workflows populated
5. API pods can connect to database

### SQL Scripts Executed (in order)
1. **schema.sql** - Complete table creation with indexes and foreign keys
2. **migration_add_workflow_integration.sql** - Workflow integration features
3. **migration_add_model_to_workflow_blocks.sql** - AI model per workflow block
4. **migration-custom-instructions.sql** - Custom instructions functionality

### Common Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| Job stuck in "Running" | MySQL not accessible | Check service name and network |
| Job fails immediately | Wrong credentials | Verify MYSQL_ROOT_PASSWORD secret |
| Job fails on schema | Permission denied | Grant CREATE/ALTER privileges |
| Job fails on migration | Duplicate execution | Migrations are idempotent, check logs |

This completes the migration guide for using external MySQL with your external-ollama TaskFlow deployment.