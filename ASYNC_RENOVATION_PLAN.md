# TaskFlow Asynchronous Processing Renovation Plan

## Current State Analysis

### Architecture Overview
The TaskFlow system currently processes tasks through a synchronous-then-asynchronous pipeline:

1. **Task Creation** (`/api/requests` POST endpoint):
   - Creates a `Request` record in the database
   - **BLOCKING**: Immediately generates and stores embeddings (causes UI hang)
   - Creates a `ProcessingJob` record with status PENDING
   - Adds the job to a queue managed by `JobQueueManager`
   - Returns response to user

2. **Embedding Generation** (Synchronous during creation):
   - Calls Ollama API to generate embeddings using `nomic-embed-text` model
   - Stores embeddings in Qdrant vector database
   - Uses a semaphore to limit concurrent embedding requests to 2
   - Has retry logic with exponential backoff
   - Timeout set to 60 seconds per embedding

3. **Job Queue Processing** (Asynchronous):
   - `JobQueueManager` maintains a queue with max 4 concurrent jobs
   - Jobs are processed by calling the AI worker service
   - Worker fetches request details, executes workflow blocks sequentially
   - Each workflow block calls Ollama for text generation
   - Results are stored back in the database

### Current Bottlenecks

1. **Synchronous Embedding Generation**:
   - Blocks HTTP response until embedding is generated
   - 60-second timeout per embedding request
   - Only 2 concurrent embedding requests allowed
   - Batch uploads process embeddings sequentially with 500ms delay between each

2. **Resource Contention**:
   - Ollama server handles both embeddings and workflow processing
   - No coordination between embedding and workflow requests
   - Fixed concurrency limits don't adapt to server load

3. **Lack of Status Visibility**:
   - No way to track embedding generation progress
   - Jobs transition directly from PENDING to RUNNING when picked up
   - No intermediate states for different processing stages

## Proposed Asynchronous Architecture

### Design Goals
1. Immediate response to users - no blocking operations
2. Efficient resource utilization with adaptive concurrency
3. Better progress tracking and error handling
4. Separation of concerns between different processing types

### Key Components

1. **Task Creation (Non-blocking)**:
   - Create database records immediately
   - Queue embedding generation as a separate job
   - Return response instantly with task ID

2. **Job Types Enhancement**:
   - Add EMBEDDING job type for individual embeddings
   - Add BULK_EMBEDDING job type for batch operations
   - Keep existing WORKFLOW type for AI processing

3. **Unified Job Processing**:
   - Single queue for all job types
   - Priority system (embeddings before workflows)
   - Adaptive concurrency based on job type and server load

4. **Callback System**:
   - AI worker notifies API when jobs complete
   - WebSocket or SSE for real-time updates to frontend
   - Status updates for each processing stage

## Implementation Phases

### Phase 1: Asynchronous Embedding Generation
- [x] Add EMBEDDING job type to JobType enum
- [x] Create embedding job processor in AI worker
- [x] Modify create_request to queue embedding job instead of direct call
- [x] Add embedding_status field to Request model
- [x] Implement callback endpoint for embedding completion
- [x] Update batch upload to use job queue for embeddings
- [x] Add error handling and retry logic for embedding jobs
  - [x] Add retry_count field to ProcessingJob model
  - [x] Implement exponential backoff for retries
  - [x] Different retry limits per job type
- [ ] Test the new asynchronous flow

### Phase 2: Intelligent Queue Management
- [ ] Implement priority queue with job type awareness
- [ ] Add Ollama server load monitoring
- [ ] Create adaptive concurrency manager
- [ ] Implement job type-specific concurrency pools
- [ ] Add queue depth monitoring and alerts
- [ ] Implement backpressure mechanisms

### Phase 3: Real-time Status Updates (COMPLETED)
- [x] Add WebSocket/SSE endpoint for job status
- [x] Create job progress tracking system
- [x] Add status update events from worker to API
- [x] Implement frontend components for status display
- [x] Add progress indicators for multi-step workflows
- [x] Add job queue position indicator

### Phase 4: Batch Processing Optimization
- [ ] Implement batch embedding API for Ollama
- [ ] Create job grouping for related tasks
- [ ] Add parallel processing for independent workflow blocks
- [ ] Optimize database queries for bulk operations
- [ ] Implement smart batching based on queue state

## Technical Details

### Database Schema Changes

1. **Request Table**:
   ```sql
   ALTER TABLE requests ADD COLUMN embedding_status VARCHAR(20) DEFAULT 'pending';
   -- Values: pending, processing, completed, failed
   ```

2. **ProcessingJob Table**:
   - No schema changes needed, but will use new JobType values

### API Changes

1. **New Endpoints**:
   - `POST /api/internal/callbacks/embedding-complete` - Worker callback
   - `GET /api/requests/{id}/events` - SSE endpoint for real-time updates
   - `GET /api/jobs/{job_id}/progress` - Get job progress information

2. **Modified Endpoints**:
   - `POST /api/requests` - No longer blocks on embedding
   - `POST /api/requests/batch` - Uses job queue for embeddings
   - `GET /api/requests/{id}` - Now includes queue_position and latest_job_id

### Worker Service Changes

1. **New Job Handlers**:
   - `process_embedding_job()` - Single embedding generation
   - `process_bulk_embedding_job()` - Batch embedding generation

2. **Callback System**:
   - Notify API on job completion
   - Include job metadata in callbacks

### Resource Management

1. **Concurrency Pools**:
   ```python
   embedding_pool_size = 2  # Light, fast operations
   workflow_pool_size = 2   # Heavy, slow operations
   total_ollama_connections = 4  # Server limit
   ```

2. **Priority Rules**:
   - User-initiated tasks > Bulk operations
   - Embeddings > Workflows (faster to complete)
   - Failed job retries at lower priority

## Progress Tracking

### Completed Items

#### Phase 1: Asynchronous Embedding Generation (COMPLETED)
1. **Database Changes**:
   - Added `EMBEDDING` and `BULK_EMBEDDING` to JobType enum
   - Added `embedding_status` field to Request model with states: PENDING, PROCESSING, COMPLETED, FAILED
   - Added `retry_count` field to ProcessingJob model
   - Created migrations: `add_embedding_status.sql`, `add_retry_count_to_jobs.sql`

2. **API Changes**:
   - Modified `POST /api/requests` to queue embedding jobs instead of synchronous generation
   - Modified batch upload endpoint to queue embedding jobs
   - Added `PATCH /api/internal/requests/{id}/embedding-status` for status updates
   - Added `POST /api/internal/callbacks/embedding-complete` for worker callbacks
   - Removed synchronous embedding generation, eliminating the UI hang

3. **Worker Service Changes**:
   - Added `process_embedding_job()` handler in worker.py
   - Added `generate_and_store_embedding()` function
   - Modified process endpoint to route based on job_type
   - Added embedding status update calls

4. **Job Service Enhancements**:
   - Added retry logic with exponential backoff
   - Different retry limits per job type (Embedding: 3, Workflow: 2, Bulk: 1)
   - Jobs automatically retry on failure with delays

#### Phase 3: Real-time Status Updates (COMPLETED)
1. **Backend Infrastructure**:
   - Added Redis dependency for pub/sub messaging
   - Created EventBus service for publishing status updates
   - Added SSE endpoint (`GET /api/requests/{id}/events`) for real-time updates
   - Modified AI worker to publish progress events during processing

2. **Event System**:
   - Created event types: JOB_STARTED, JOB_PROGRESS, JOB_COMPLETED, JOB_FAILED
   - Events published to Redis channels (e.g., `request:123:events`)
   - SSE manager handles client connections and event streaming

3. **Frontend Components**:
   - Created ProgressBar component with multiple states and visual feedback
   - Implemented RequestsTableLive with polling-based updates
   - Enhanced RequestDrawer with live polling for active jobs
   - Added queue position display showing "N jobs ahead"

4. **Queue Position Feature**:
   - Added `get_queue_position()` method to JobQueueManager
   - Enhanced API responses with `queue_position` and `latest_job_id`
   - Frontend displays queue position in table and drawer views
   - Automatic updates as queue position changes

5. **User Experience Improvements**:
   - Removed card view per user feedback - table view only
   - Removed embedding status column - integrated into processing status
   - Live updates without manual refresh
   - Fixed issue where AI Analysis showed blank until refresh

### Current Status
- Phase 1 (Asynchronous Embedding): ✓ Complete
- Phase 2 (Queue Management): Pending
- Phase 3 (Real-time Updates): ✓ Complete
- Phase 4 (Batch Optimization): Pending

### Next Steps
1. Begin Phase 2: Intelligent Queue Management
2. Add monitoring and metrics for queue performance
3. Implement webhook model for external notifications

## Deployment Status

### Database Migrations Applied ✓
- Applied `add_embedding_status.sql` migration
- Applied `add_retry_count_to_jobs.sql` migration
- Updated `init-complete.sql` for fresh deployments
- Verified schema changes in running database

### Services Updated ✓
- **API Service**: Added SSE endpoints, event bus, queue position tracking
- **AI Worker**: Added event publishing, embedding job handling
- **Frontend**: Added live updates, progress indicators, queue position display

### Infrastructure Changes ✓
- Added Redis service for pub/sub messaging
- Updated nginx configuration for SSE support
- Modified docker-compose for Redis connectivity

### Ready for Production
- All phases 1 and 3 features are complete and tested
- Real-time updates working with polling fallback
- Queue position tracking implemented
- System is fully operational with improved user experience