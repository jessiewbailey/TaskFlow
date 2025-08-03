# Job Queue Position Feature

## Overview

The job queue position feature provides users with real-time visibility into where their processing job stands in the queue. This helps set expectations for processing time and improves the user experience.

## Implementation Details

### Backend Changes

1. **JobQueueManager Enhancement** (`backend/app/services/job_service.py`)
   - Added `get_queue_position()` method to determine a job's position in the queue
   - Returns -1 if job is already running or not found
   - Returns 0-based position for queued jobs

2. **API Response Enhancement** (`backend/app/models/pydantic_models.py`)
   - Added `queue_position: Optional[int]` field to `RequestResponse`
   - Added `latest_job_id: Optional[str]` field to track the current job

3. **Request Endpoint Update** (`backend/app/routers/requests.py`)
   - Modified `get_request()` to fetch active job details
   - Calls `job_queue_manager.get_queue_position()` for pending jobs
   - Includes queue position in API response

### Frontend Changes

1. **Type Updates** (`frontend/src/types/index.ts`)
   - Added `queue_position?: number` to `Task` interface
   - Added `latest_job_id?: string` to `Task` interface

2. **Table Display** (`frontend/src/components/RequestsTableLive.tsx`)
   - Updated `ProcessingStatus` component to show queue position
   - Displays "Starting..." when position is 0
   - Displays "N jobs ahead" when position > 0
   - Falls back to "Processing..." if position unavailable

3. **Drawer Display** (`frontend/src/components/RequestDrawer.tsx`)
   - Added queue position indicator in AI Analysis tab
   - Shows amber-colored alert box with queue information
   - Automatically updates as job progresses

## User Experience

Users will see:

1. **In Table View:**
   - "3 jobs ahead" - When waiting in queue
   - "Starting..." - When job is about to begin
   - "Processing..." - When actively processing
   - Progress bar (when available)

2. **In Request Drawer:**
   - Prominent amber alert showing queue position
   - Informative message about automatic updates
   - Real-time updates as position changes

## Technical Notes

- Queue positions are 0-based internally but displayed as human-friendly counts
- The feature degrades gracefully if queue position is unavailable
- Polling continues until job completion to ensure live updates
- Maximum concurrent jobs is set to 4 (configurable in JobQueueManager)

## Future Enhancements

1. Estimated wait time based on average job duration
2. Queue visualization showing all pending jobs
3. Priority queue support for urgent requests
4. Admin controls to manage queue and reorder jobs