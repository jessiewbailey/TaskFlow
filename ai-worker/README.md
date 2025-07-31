# TaskFlow AI Worker

The AI Worker is a microservice responsible for executing dynamic AI workflows using Ollama as the LLM backend. It processes document requests through customizable workflow pipelines.

## Overview

The AI Worker service:
- Executes dynamic workflows defined in the TaskFlow system
- Processes requests through a series of workflow blocks
- Supports per-block custom instructions
- Tracks token usage and processing duration
- Saves results to the backend database

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Backend API   │────▶│   AI Worker  │────▶│   Ollama    │
│                 │     │              │     │   Server    │
│ - Creates jobs  │     │ - Workflow   │     │             │
│ - Stores results│◀────│   Processor  │◀────│ - LLM calls │
└─────────────────┘     └──────────────┘     └─────────────┘
```

## Key Components

### 1. Worker Service (`worker.py`)
- FastAPI application that exposes the `/process` endpoint
- Handles workflow execution requests
- Manages result storage and versioning

### 2. Workflow Processor (`ai_pipeline/workflow_processor.py`)
- Core workflow execution engine
- Processes workflow blocks in sequence
- Manages context passing between blocks
- Handles custom instructions per block
- Supports dynamic model parameters

### 3. Configuration (`config.py`)
- Environment-based configuration
- Ollama connection settings
- API endpoints and retry logic

## API Endpoints

### POST `/process`
Processes a document request using a workflow.

**Request Body:**
```json
{
  "request_id": 123,
  "workflow_id": 456
}
```

**Response:**
```json
{
  "status": "completed",
  "version": 1
}
```

### GET `/healthz`
Health check endpoint that verifies Ollama connectivity.

## Workflow Execution Flow

1. **Request Reception**
   - Backend creates a processing job
   - Sends request to AI Worker with workflow ID

2. **Workflow Loading**
   - Fetches workflow definition from backend
   - Retrieves custom instructions if available

3. **Block Execution**
   - Executes blocks in order
   - Each block can:
     - Use different LLM models
     - Have custom instructions
     - Define output schemas
     - Access outputs from previous blocks

4. **Context Management**
   - Request text available to all blocks
   - Block outputs stored in context
   - Variables can be referenced in prompts using `{variable_name}`

5. **Result Storage**
   - Extracts metadata (tokens, duration)
   - Attempts to extract common fields for backward compatibility:
     - `topic` (from fields named `topic` or `primary_topic`)
     - `sensitivity_score` (from fields named `score` or `sensitivity_score`)
     - `redactions` (from fields named `redaction_suggestions` or `redactions`)
   - Stores complete workflow output as JSON in `summary` field

## Workflow Block Structure

Each workflow block contains:
- `name`: Block identifier
- `order`: Execution sequence
- `prompt`: Template with variable substitution
- `model_name`: Optional specific model override
- `output_schema`: Optional JSON schema for structured output
- `model_parameters`: Optional LLM parameters (temperature, max_tokens, etc.)
- `inputs`: Input configuration for the block

### Block Input Types

1. **REQUEST_TEXT**: Maps the original request text to a variable
2. **BLOCK_OUTPUT**: Maps output from a previous block to a variable

Example block with inputs:
```json
{
  "name": "Analyze Summary",
  "order": 2,
  "prompt": "Based on this summary: {summary_text}, identify key themes",
  "inputs": [
    {
      "variable_name": "summary_text",
      "input_type": "BLOCK_OUTPUT",
      "source_block_id": 1
    }
  ]
}
```

## Custom Instructions

Custom instructions can be added per-block through the backend API. They are appended to the block's prompt while maintaining the required output format.

## Environment Variables

- `OLLAMA_HOST`: Ollama server URL (default: http://localhost:11434)
- `MODEL_NAME`: Default LLM model (default: llama3.2:3b)
- `BACKEND_API_URL`: Backend API endpoint
- `API_HOST`: Service host (default: 0.0.0.0)
- `API_PORT`: Service port (default: 8001)
- `MAX_RETRIES`: LLM call retry attempts (default: 3)

## Database Schema Notes

The AI output is stored with these fields:
- `summary`: Complete workflow output as JSON string (primary data field)
- `topic`: Deprecated - always stored as NULL
- `sensitivity_score`: Deprecated - always stored as NULL
- `redactions_json`: Deprecated - always stored as NULL
- `custom_instructions`: Deprecated - always stored as NULL
- `tokens_used`: Total tokens across all blocks
- `duration_ms`: Total processing time
- `model_name`: Default model used (individual blocks may override)

All workflow outputs are stored in the `summary` field as a JSON object where keys are block names and values are the block outputs.

## Development

### Running Locally
```bash
cd ai-worker
pip install -r requirements.txt
python worker.py
```

### Docker
```bash
docker build -t taskflow-ai-worker .
docker run -p 8001:8001 taskflow-ai-worker
```

## Future Improvements

1. **Database Schema Update**: Remove the deprecated columns (topic, sensitivity_score, redactions_json, custom_instructions) from the database schema once all historical data has been migrated.

2. **Streaming Support**: Add support for streaming LLM responses for long-running workflows.

3. **Parallel Block Execution**: Support for executing independent blocks in parallel.

4. **Caching**: Add caching for repeated block executions with same inputs.

5. **Better Error Handling**: More granular error types and recovery strategies.