# Workflow Configuration Tables Fix

## Issue
"Failed to save similarity configuration" error was occurring when trying to save workflow similarity or embedding configurations.

## Root Cause
The `workflow_similarity_configs` and `workflow_embedding_configs` tables were missing from the database. These tables are required for storing:
- Embedding generation configuration (template and enabled status)
- Similarity display configuration (fields to show in similar tasks)

## Fix Applied

### 1. Created Missing Tables
```sql
CREATE TABLE workflow_embedding_configs (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    embedding_template TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id)
);

CREATE TABLE workflow_similarity_configs (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    fields JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workflow_id)
);
```

### 2. Updated Kubernetes Init Script
Added these tables to `/k8s/base/01-init-complete.sql` to ensure they're created during fresh deployments.

### 3. Created Alembic Migration
Added migration file `add_workflow_embedding_similarity_configs.py` for existing deployments.

### 4. Added Comprehensive Tests
Created test suites:
- `test_workflow_similarity_config.py` - Tests for similarity configuration CRUD operations
- `test_workflow_embedding_config.py` - Tests for embedding configuration CRUD operations

## API Usage

### Similarity Configuration
```bash
# Create/Update similarity config
curl -X POST http://localhost:8000/api/workflows/{workflow_id}/similarity-config \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [
      {
        "name": "summary",
        "type": "text",
        "source": "Summarize Request.summary"
      },
      {
        "name": "status",
        "type": "text", 
        "source": "request.status"
      }
    ]
  }'

# Get similarity config
curl http://localhost:8000/api/workflows/{workflow_id}/similarity-config
```

### Embedding Configuration
```bash
# Create/Update embedding config
curl -X POST http://localhost:8000/api/workflows/{workflow_id}/embedding-config \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "embedding_template": "Request: {request_text}\\n\\nSummary: {block_summarize_request}"
  }'

# Get embedding config
curl http://localhost:8000/api/workflows/{workflow_id}/embedding-config
```

## Verification
Both configurations are now working correctly and persisting to the database.