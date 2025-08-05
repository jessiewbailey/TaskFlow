# Database Initialization File Updates

## Changes Made

### 1. Updated `/database/postgresql/init-complete.sql`
Added the workflow configuration tables to the main database initialization file:

#### Workflow Embedding Configuration Table
```sql
CREATE TABLE workflow_embedding_configs (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  embedding_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id)
);

CREATE INDEX idx_workflow_embedding_configs_workflow_id ON workflow_embedding_configs(workflow_id);
```

#### Workflow Similarity Configuration Table
```sql
CREATE TABLE workflow_similarity_configs (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id)
);

CREATE INDEX idx_workflow_similarity_configs_workflow_id ON workflow_similarity_configs(workflow_id);
CREATE INDEX idx_workflow_similarity_configs_fields ON workflow_similarity_configs USING GIN (fields);
```

#### Update Triggers
Added triggers for automatic updated_at timestamp updates:
```sql
CREATE TRIGGER update_workflow_embedding_configs_updated_at 
    BEFORE UPDATE ON workflow_embedding_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_similarity_configs_updated_at 
    BEFORE UPDATE ON workflow_similarity_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Updated `/database/postgresql/init-complete-patch.sql`
- Removed redundant table definitions that are now in the main init file
- Kept only pgvector-specific additions that aren't in the main file
- Added note indicating the workflow config tables are now in main init file

### 3. Consistent with Kubernetes Init
The changes match what was added to `/k8s/base/01-init-complete.sql`, ensuring consistency across all initialization scripts.

## Benefits
1. **Fresh deployments** will automatically have the workflow configuration tables
2. **Existing deployments** can use the Alembic migration or apply the SQL directly
3. **No more missing table errors** for similarity and embedding configurations
4. **Proper indexing** for performance with GIN indexes on JSONB fields

## Usage
For fresh deployments, simply run the init-complete.sql file and all tables will be created properly. For existing deployments, either:
1. Run the Alembic migration: `alembic upgrade head`
2. Or manually apply the missing tables from the SQL above