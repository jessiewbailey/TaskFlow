# TaskFlow Request Processing Flow

This document describes the complete flow of a request through the TaskFlow system, from initial submission to final display in the AI Analysis dashboard.

## Overview

The TaskFlow system processes user-submitted tasks through customizable workflows, executing a series of AI-powered steps to analyze and transform the input data. The results are then displayed in a configurable dashboard interface.

## System Architecture

### Components

1. **Frontend (React/TypeScript)**
   - User interface for task submission and management
   - Dashboard for viewing AI analysis results
   - Workflow and dashboard configuration tools

2. **Backend API (FastAPI/Python)**
   - RESTful API for managing requests, workflows, and users
   - Database operations and business logic
   - Job queue management

3. **AI Worker (Python/Ollama)**
   - Asynchronous processing of workflow jobs
   - Integration with Ollama for LLM operations
   - Workflow execution engine

4. **Database (PostgreSQL)**
   - Persistent storage for all system data
   - Includes tables for requests, workflows, AI outputs, etc.

## Request Flow

### 1. Task Submission

**User Action**: User clicks "New Task" button and fills out the form
- Frontend Component: `NewRequestModal` (`/frontend/src/components/NewRequestModal.tsx`)
- User provides:
  - Task description (required)
  - Requester name (optional)
  - Workflow selection (optional - defaults to system default)

**API Call**: POST `/api/requests`
- Handler: `create_request()` in `/backend/app/routers/requests.py`
- Creates new request record with status `NEW`
- If no workflow specified, assigns the default workflow (marked with `is_default=true`)
- Returns the created request details

**Database Operations**:
- New record inserted into `requests` table
- Fields: `text`, `requester`, `workflow_id`, `status`, `date_received`, etc.

### 2. Job Creation

**Automatic Job Creation**: After request is saved, a processing job is created
- Service: `JobService.create_job()` in `/backend/app/services/job_service.py`
- Job types:
  - `WORKFLOW`: Standard workflow-based processing (default)
  - `CUSTOM`: Reprocessing with custom instructions
  - `STANDARD`: Legacy hardcoded pipeline (deprecated)

**Database Operations**:
- New record inserted into `processing_jobs` table
- Fields: `request_id`, `job_type`, `status` (initially `PENDING`), `workflow_id`
- Job is queued for asynchronous processing

### 3. Workflow Execution

**AI Worker Processing**: The AI worker polls for pending jobs
- Worker: `/ai-worker/worker.py`
- Endpoint: `/process-request/{request_id}`
- Steps:
  1. Fetches job details from database
  2. Retrieves workflow configuration
  3. Executes workflow blocks in order

**Workflow Processor**: `WorkflowProcessor.execute_workflow()` in `/ai-worker/ai_pipeline/workflow_processor.py`
- Process:
  1. Fetches workflow and blocks from backend API
  2. Sorts blocks by their `order` field
  3. Creates block ID to name mapping for input resolution
  4. Executes each block sequentially:
     - Prepares block context with input variables
     - Substitutes variables in prompt template
     - Calls Ollama API with the prepared prompt
     - Parses JSON response
     - Stores result in context for subsequent blocks

**Block Types**:
- `CORE`: System-defined blocks (shouldn't be modified)
- `CUSTOM`: User-defined blocks

**Block Inputs**:
- `REQUEST_TEXT`: Original task text
- `BLOCK_OUTPUT`: Output from a previous block (referenced by block ID)

### 4. Context Management

**Variable Storage**: As blocks execute, their outputs are stored in multiple formats:
- Block name (exact): `results[block_name] = result`
- Lowercase with underscores: `context[block_name.lower().replace(' ', '_')] = result`
- Common aliases for compatibility:
  - Metadata blocks → `basic_metadata`
  - Topic blocks → `topic_classification`, `topic_info`, `topic`
  - Summary blocks → `summary`
  - Sensitivity blocks → `sensitivity_assessment`, `sensitivity_score`
  - Action blocks → `redaction_suggestions`

**Variable Access**: Subsequent blocks can access previous outputs via:
- Block input configuration specifying `source_block_id`
- Variable substitution in prompt templates using `{variable_name}`

### 5. AI Output Storage

**Result Compilation**: After all blocks execute
- Worker: `/ai-worker/worker.py` (lines 180-189)
- All block results are stored as JSON in the `summary` field
- Additional fields extracted for common use cases:
  - `topic`: Primary topic from topic classification blocks
  - `sensitivity_score`: Score from sensitivity assessment blocks
  - `redactions_json`: Suggestions from action blocks

**Database Operations**:
- New record inserted into `ai_outputs` table
- Fields: `request_id`, `version`, `summary` (JSON), `topic`, `sensitivity_score`, etc.
- Version increments for each reprocessing

**API Call**: POST `/api/internal/ai-outputs`
- Internal endpoint for AI worker to save results
- Updates request status after successful processing

### 6. Dashboard Display

**Request List View**: Main dashboard shows all tasks
- Component: `/frontend/src/pages/Dashboard.tsx`
- Fetches requests with their latest AI outputs
- Displays status, assignee, dates, and basic info

**AI Analysis Tab**: Detailed view in request drawer
- Component: `RequestDrawer` (`/frontend/src/components/RequestDrawer.tsx`)
- Tab: "AI Analysis"
- Process:
  1. Loads dashboard configuration for the workflow
  2. Transforms AI output data to match expected structure
  3. Renders using `DashboardRenderer` component

**Dashboard Configuration**:
- Stored in `workflow_dashboard_configs` table
- Configured via `DashboardBuilder` component
- Fields specify:
  - Which block outputs to display
  - Display type (progress bar, badge, list, card, json, text)
  - Layout and ordering

**Data Transformation**: `transformAIOutputData()` in RequestDrawer
- Parses the JSON `summary` field from AI output
- For workflow outputs: Returns the parsed JSON directly
- For legacy outputs: Maps to expected structure for backward compatibility

### 7. Dashboard Rendering

**Component**: `DashboardRenderer` (`/frontend/src/components/DashboardRenderer.tsx`)
- Input: Dashboard configuration + transformed AI output data
- Process:
  1. For each configured field:
     - Extracts value using `block_name` and `field_path`
     - Renders according to `display_type`
  2. Handles missing fields gracefully
  3. Supports various display types with responsive layouts

**Field Resolution**: `getFieldValue()` function
- Direct path matching: `data[blockName][fieldPath]`
- Fuzzy matching: Looks for similar field names (case-insensitive)
- Fallback: Returns first non-null value if exact match fails

## Common Issues and Solutions

### Issue: Timestamp appears instead of workflow output

**Causes**:
1. Workflow execution failed
2. No dashboard configuration for the workflow
3. Block outputs not properly stored
4. Variable resolution issues between blocks

**Solutions**:
1. Check AI worker logs for execution errors
2. Ensure dashboard is configured with appropriate fields
3. Verify block names match between workflow and dashboard config
4. Check that block inputs correctly reference source block IDs

### Issue: Variables not available between blocks

**Cause**: Block ID mapping issue in workflow processor

**Solution**: Fixed in workflow processor to properly map block IDs to names when resolving BLOCK_OUTPUT inputs

### Issue: Dashboard shows "No dashboard configuration found"

**Cause**: Workflow lacks dashboard configuration

**Solution**: Use the workflow editor to configure dashboard fields for the workflow

## Database Schema (Key Tables)

### requests
- `id`: Primary key
- `text`: Task description
- `requester`: Who submitted the task
- `workflow_id`: Associated workflow
- `status`: Current status (NEW, IN_REVIEW, etc.)
- `assigned_analyst_id`: Assigned user

### workflows
- `id`: Primary key
- `name`: Workflow name
- `description`: Workflow description
- `is_active`: Whether workflow is available
- `is_default`: Default workflow flag

### workflow_blocks
- `id`: Primary key
- `workflow_id`: Parent workflow
- `name`: Block name
- `prompt`: Prompt template
- `order`: Execution order
- `block_type`: CORE or CUSTOM

### workflow_block_inputs
- `id`: Primary key
- `block_id`: Parent block
- `input_type`: REQUEST_TEXT or BLOCK_OUTPUT
- `source_block_id`: For BLOCK_OUTPUT type
- `variable_name`: Variable name for prompt

### ai_outputs
- `id`: Primary key
- `request_id`: Associated request
- `version`: Version number
- `summary`: JSON containing all block outputs
- `topic`, `sensitivity_score`, etc.: Extracted fields

### workflow_dashboard_configs
- `id`: Primary key
- `workflow_id`: Associated workflow
- `fields`: JSON array of field configurations
- `layout`: Dashboard layout type

## Batch Processing

The system also supports batch operations:

### Batch Upload
- Endpoint: `/api/requests/batch`
- Accepts CSV/Excel files
- Creates multiple requests at once

### Bulk Rerun
- Endpoint: `/api/requests/bulk-rerun`
- Reprocesses all requests with a new workflow
- Useful for updating analyses with improved prompts

## Summary

The TaskFlow system provides a flexible, workflow-based approach to processing tasks through AI analysis pipelines. The modular architecture allows for easy customization of both processing steps and result display, while maintaining consistency and traceability throughout the system.