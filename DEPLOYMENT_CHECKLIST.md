# Async Task Processing Deployment Checklist

## Pre-Deployment Steps

1. **Backup Database** (Optional but recommended)
   ```bash
   kubectl exec -i $(kubectl get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- pg_dump -U taskflow taskflow > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Apply Database Migrations**
   ```bash
   cd scripts
   ./apply-async-migrations.sh
   ```

## Build and Deploy

1. **Build and Push Images**
   ```bash
   cd scripts
   ./build-and-push.sh
   ```

2. **Deploy Updated Services**
   ```bash
   ./deploy.sh
   ```

## Verification Steps

1. **Check Pod Status**
   ```bash
   kubectl get pods
   # All pods should be Running
   ```

2. **Check API Logs**
   ```bash
   kubectl logs -f $(kubectl get pods -l app=taskflow-api -o jsonpath='{.items[0].metadata.name}')
   ```

3. **Check Worker Logs**
   ```bash
   kubectl logs -f $(kubectl get pods -l app=taskflow-ai -o jsonpath='{.items[0].metadata.name}')
   ```

## Testing the Async Flow

1. **Create a Single Task**
   - Should return immediately
   - Check that embedding_status is PENDING
   - Monitor worker logs for embedding job processing

2. **Check Task Status**
   ```bash
   # Get request details via API
   curl http://localhost:8000/api/requests/{id}
   # Should show embedding_status field
   ```

3. **Test Batch Upload**
   - Upload multiple tasks
   - Should return immediately
   - Check job queue processing in worker logs

4. **Test Error Handling**
   - Stop Ollama temporarily
   - Create a task
   - Should see retry attempts in worker logs
   - Restart Ollama and verify completion

## Rollback Plan

If issues occur:

1. **Revert Code Changes**
   ```bash
   git checkout main
   ```

2. **Rebuild and Deploy Previous Version**
   ```bash
   cd scripts
   ./build-and-push.sh
   ./deploy.sh
   ```

3. **Revert Database Changes** (if needed)
   ```sql
   ALTER TABLE requests DROP COLUMN IF EXISTS embedding_status;
   ALTER TABLE processing_jobs DROP COLUMN IF EXISTS retry_count;
   DROP TYPE IF EXISTS embedding_status;
   ```

## Post-Deployment Monitoring

1. **Monitor Job Processing**
   - Check that embedding jobs are being processed
   - Verify retry logic works for failures
   - Monitor queue depth

2. **Performance Metrics**
   - Task creation response time (should be < 100ms)
   - Embedding generation time
   - Job success/failure rates

3. **User Experience**
   - Confirm no UI hangs when creating tasks
   - Verify batch uploads work smoothly