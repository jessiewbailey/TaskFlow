# Vector Database (Qdrant) Inspection Guide

This guide provides commands and procedures for inspecting and troubleshooting the Qdrant vector database used by TaskFlow for RAG (Retrieval-Augmented Generation) search functionality.

## Overview

TaskFlow uses Qdrant as its vector database to store embeddings for semantic similarity search. Each task's text content is converted into a 768-dimensional vector using an embedding model, which enables finding semantically similar tasks.

## Prerequisites

- `kubectl` access to the TaskFlow cluster
- `curl` and `jq` installed for API calls
- Port forwarding set up to access Qdrant

## Setting Up Port Forwarding

Before running any inspection commands, you need to forward the Qdrant port:

```bash
# Forward Qdrant port
kubectl port-forward -n taskflow svc/qdrant 6333:6333 &

# Verify port forwarding is working
curl -s http://localhost:6333/collections
```

## Inspection Commands

### 1. List All Collections

```bash
curl -s http://localhost:6333/collections | jq
```

Expected output:
```json
{
  "result": {
    "collections": [
      {
        "name": "tasks"
      }
    ]
  },
  "status": "ok",
  "time": 0.000005554
}
```

### 2. Get Collection Details

```bash
curl -s http://localhost:6333/collections/tasks | jq
```

This shows:
- `points_count`: Number of tasks with embeddings
- `indexed_vectors_count`: Number of indexed vectors (may be 0 initially)
- `vectors.size`: Dimension of vectors (should be 768)
- `vectors.distance`: Distance metric used (Cosine)

### 3. List All Points with Metadata

```bash
curl -s -X POST http://localhost:6333/collections/tasks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 10,
    "with_payload": true,
    "with_vector": false
  }' | jq
```

This returns task metadata without the large vector data.

### 4. View Points with Vectors

```bash
curl -s -X POST http://localhost:6333/collections/tasks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 1,
    "with_payload": true,
    "with_vector": true
  }' | jq
```

This includes the full 768-dimensional vector for each point.

### 5. Get Specific Point by ID

```bash
# Replace <point-id> with actual UUID
curl -s http://localhost:6333/collections/tasks/points/<point-id> | jq
```

### 6. Count Points in Collection

```bash
curl -s -X POST http://localhost:6333/collections/tasks/points/count \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

### 7. Search with Filter

```bash
curl -s -X POST http://localhost:6333/collections/tasks/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 10,
    "filter": {
      "must": [
        {
          "key": "exercise_id",
          "match": {
            "value": 1
          }
        }
      ]
    },
    "with_payload": true,
    "with_vector": false
  }' | jq
```

## Troubleshooting

### No Search Results

If RAG search returns no results:

1. **Check if embeddings exist**:
   ```bash
   curl -s http://localhost:6333/collections/tasks | jq '.result.points_count'
   ```

2. **Verify embedding generation logs**:
   ```bash
   kubectl logs -n taskflow -l app=taskflow-api --tail=50 | grep -i embedding
   ```

3. **Check task embedding status in PostgreSQL**:
   ```bash
   kubectl exec -n taskflow postgres-0 -- psql -U taskflow_user -d taskflow_db \
     -c "SELECT id, embedding_status FROM requests ORDER BY id DESC LIMIT 10;"
   ```

### Common Issues

1. **"indexed_vectors_count": 0**
   - This is normal for small collections
   - Qdrant indexes vectors after reaching a threshold
   - Search still works without indexing, just slightly slower

2. **Vector dimension mismatch**
   - TaskFlow uses 768-dimensional vectors
   - Ensure embedding service is using the correct model
   - Check logs for embedding generation errors

3. **Empty collection**
   - New deployments start with empty Qdrant
   - Embeddings are generated when tasks are created/updated
   - Check if embedding service is running

### Testing Search Functionality

To test if search is working, you can perform a similarity search using the API:

```bash
# First, get an embedding for a test query via the TaskFlow API
# Then use it to search directly in Qdrant

# Example: Search for top 5 similar tasks
curl -s -X POST http://localhost:6333/collections/tasks/points/search \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [<768-dimensional-vector>],
    "limit": 5,
    "with_payload": true
  }' | jq
```

## Monitoring Qdrant Health

```bash
# Check Qdrant pod status
kubectl get pods -n taskflow -l app=qdrant

# View Qdrant logs
kubectl logs -n taskflow -l app=qdrant --tail=50

# Check resource usage
kubectl top pod -n taskflow -l app=qdrant
```

## Related Documentation

- [RAG Search Configuration](./rag-search-configuration.md)
- [Embedding Service](./embedding-service.md)
- [Workflow Similarity Configuration](./workflow-similarity-config.md)