from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
import structlog
import asyncio
import httpx
import json
from config import settings
from ai_pipeline.workflow_processor import WorkflowProcessor
from event_publisher import event_publisher
import ollama
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import uuid
import os

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TaskFlow AI Worker service")
    await event_publisher.connect()
    yield
    # Shutdown
    logger.info("Shutting down TaskFlow AI Worker service")
    await event_publisher.disconnect()

app = FastAPI(
    title="TaskFlow AI Worker", 
    description="AI processing service for document requests",
    version="1.0.0",
    lifespan=lifespan
)

class ProcessRequest(BaseModel):
    request_id: int
    workflow_id: Optional[int] = None
    job_type: str = "WORKFLOW"  # WORKFLOW, EMBEDDING, BULK_EMBEDDING
    custom_instructions: Optional[str] = None

@app.post("/process")
async def process_request(request: ProcessRequest):
    """Process a document request using AI pipeline"""
    
    logger.info("Received processing request", 
                request_id=request.request_id, 
                job_type=request.job_type,
                workflow_id=request.workflow_id)
    
    try:
        # Route to appropriate handler based on job type
        if request.job_type == "EMBEDDING":
            return await process_embedding_job(request.request_id)
        elif request.job_type == "BULK_EMBEDDING":
            # For bulk embedding, request_id contains the batch identifier
            return await process_bulk_embedding_job(request.request_id)
        elif request.job_type in ["WORKFLOW", "STANDARD", "CUSTOM"]:
            return await process_workflow_job(request)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown job type: {request.job_type}")
        
    except Exception as e:
        logger.error("Processing failed", 
                    request_id=request.request_id, 
                    job_type=request.job_type,
                    error=str(e), 
                    exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def process_workflow_job(request: ProcessRequest):
    """Process a workflow job (existing logic)"""
    # Publish job started event
    await event_publisher.job_started(request.request_id, "WORKFLOW", str(request.workflow_id))
    
    # Get request text from backend API
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{settings.backend_api_url}/api/requests/{request.request_id}"
        )
        response.raise_for_status()
        request_data = response.json()
    
    request_text = request_data["text"]
    logger.info("Retrieved request text", 
               request_id=request.request_id, 
               text_length=len(request_text))
    
    # Publish workflow started event
    await event_publisher.publish_event(request.request_id, "workflow.started", {
        "workflow_id": request.workflow_id
    })
    
    # Initialize workflow processor
    workflow_processor = WorkflowProcessor()
    
    # Set up progress callback
    async def on_step_complete(step_name: str, result: Any):
        await event_publisher.workflow_step_completed(request.request_id, step_name, result)
    
    async def on_progress(step_number: int, total_steps: int, current_step: str, progress: float, completed: bool = False):
        await event_publisher.job_progress(
            request.request_id, 
            progress,
            f"Step {step_number}/{total_steps}: {current_step} {'✓' if completed else '...'}"
        )
    
    workflow_processor.on_step_complete = on_step_complete
    workflow_processor.on_progress = on_progress
    
    result = await workflow_processor.execute_workflow(
        request.workflow_id, 
        request_text,
        request.request_id
    )
    # Get current version and increment
    version = await get_next_version(request.request_id)
    
    # Save AI output to database
    await save_ai_output(request.request_id, result, version)
    
    logger.info("Processing completed successfully", 
               request_id=request.request_id,
               workflow_id=request.workflow_id,
               version=version)
    
    # Publish workflow completed event
    await event_publisher.publish_event(request.request_id, "workflow.completed", {
        "workflow_id": request.workflow_id,
        "version": version
    })
    
    return {"status": "completed", "version": version}

async def process_embedding_job(request_id: int):
    """Process a single embedding generation job"""
    logger.info("Processing embedding job", request_id=request_id)
    
    try:
        # Publish job started event
        await event_publisher.job_started(request_id, "EMBEDDING")
        await event_publisher.embedding_progress(request_id, "PROCESSING", 0.1, "Fetching request data")
        
        # Get request data
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{settings.backend_api_url}/api/requests/{request_id}"
            )
            response.raise_for_status()
            request_data = response.json()
        
        # Update embedding status to PROCESSING
        await update_embedding_status(request_id, "PROCESSING")
        await event_publisher.embedding_progress(request_id, "PROCESSING", 0.3, "Preparing text for embedding")
        
        # Prepare task data for embedding
        task_data = {
            "title": f"Request #{request_id}",
            "description": request_data["text"],
            "priority": "normal",
            "status": request_data["status"],
            "tags": [],
            "exercise_id": request_data.get("exercise_id"),
            "created_at": request_data.get("created_at", "")
        }
        
        # Generate embedding
        await event_publisher.embedding_progress(request_id, "PROCESSING", 0.5, "Generating embedding vector")
        embedding_id = await generate_and_store_embedding(request_id, task_data)
        
        # Update embedding status to COMPLETED
        await update_embedding_status(request_id, "COMPLETED")
        await event_publisher.embedding_progress(request_id, "COMPLETED", 1.0, "Embedding stored successfully")
        
        logger.info("Embedding generated successfully", 
                   request_id=request_id, 
                   embedding_id=embedding_id)
        
        # Notify backend of completion
        await notify_embedding_complete(request_id, embedding_id)
        
        # Publish job completed event
        await event_publisher.job_completed(request_id, "EMBEDDING", {"embedding_id": embedding_id})
        
        return {"status": "completed", "embedding_id": embedding_id}
        
    except Exception as e:
        logger.error("Embedding generation failed", 
                    request_id=request_id, 
                    error=str(e))
        # Update embedding status to FAILED
        await update_embedding_status(request_id, "FAILED")
        
        # Publish job failed event
        await event_publisher.job_failed(request_id, "EMBEDDING", str(e))
        
        raise

async def process_bulk_embedding_job(batch_id: int):
    """Process bulk embedding generation jobs"""
    # TODO: Implement bulk embedding processing
    logger.warning("Bulk embedding processing not yet implemented", batch_id=batch_id)
    return {"status": "not_implemented"}

async def generate_and_store_embedding(task_id: int, task_data: Dict[str, Any]) -> str:
    """Generate embedding and store in Qdrant"""
    # Create text representation
    text_parts = []
    if task_data.get("title"):
        text_parts.append(f"Title: {task_data['title']}")
    if task_data.get("description"):
        text_parts.append(f"Description: {task_data['description']}")
    if task_data.get("priority"):
        text_parts.append(f"Priority: {task_data['priority']}")
    if task_data.get("status"):
        text_parts.append(f"Status: {task_data['status']}")
    if task_data.get("tags"):
        text_parts.append(f"Tags: {', '.join(task_data['tags'])}")
    
    text = "\n".join(text_parts)
    
    # Update progress
    await event_publisher.embedding_progress(task_id, "PROCESSING", 0.6, "Calling Ollama for embedding generation")
    
    # Generate embedding using Ollama
    ollama_client = ollama.AsyncClient(host=settings.ollama_host)
    response = await ollama_client.embeddings(
        model="nomic-embed-text",
        prompt=text
    )
    embedding = response['embedding']
    
    # Update progress
    await event_publisher.embedding_progress(task_id, "PROCESSING", 0.8, "Storing embedding in vector database")
    
    # Store in Qdrant
    qdrant_url = os.getenv("QDRANT_URL", "http://qdrant:6333")
    qdrant_client = QdrantClient(url=qdrant_url)
    
    point_id = str(uuid.uuid4())
    qdrant_client.upsert(
        collection_name="tasks",
        points=[
            PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "task_id": task_id,
                    "title": task_data.get("title", ""),
                    "description": task_data.get("description", ""),
                    "priority": task_data.get("priority", ""),
                    "status": task_data.get("status", ""),
                    "tags": task_data.get("tags", []),
                    "exercise_id": task_data.get("exercise_id"),
                    "created_at": task_data.get("created_at", ""),
                }
            )
        ]
    )
    
    # Update progress
    await event_publisher.embedding_progress(task_id, "PROCESSING", 0.95, "Finalizing embedding storage")
    
    return point_id

async def update_embedding_status(request_id: int, status: str):
    """Update the embedding status for a request"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                f"{settings.backend_api_url}/api/internal/requests/{request_id}/embedding-status",
                json={"embedding_status": status}
            )
            response.raise_for_status()
            logger.info(f"Updated embedding status for request {request_id} to {status}")
    except Exception as e:
        logger.error(f"Failed to update embedding status for request {request_id}: {str(e)}")
        # Don't fail the job if status update fails
        pass

async def notify_embedding_complete(request_id: int, embedding_id: str):
    """Notify backend that embedding is complete"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.backend_api_url}/api/internal/callbacks/embedding-complete",
            json={
                "request_id": request_id,
                "embedding_id": embedding_id,
                "status": "completed"
            }
        )
        response.raise_for_status()

async def get_next_version(request_id: int) -> int:
    """Get the next version number for AI output"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.backend_api_url}/api/requests/{request_id}"
            )
            response.raise_for_status()
            data = response.json()
            
            # Get the latest AI output version
            if data.get("latest_ai_output"):
                return data["latest_ai_output"]["version"] + 1
            else:
                return 1
                
    except Exception as e:
        logger.warning("Failed to get current version, defaulting to 1", error=str(e))
        return 1

async def save_ai_output(request_id: int, result: dict, version: int):
    """Save AI processing result to database"""
    
    # Extract metadata
    total_tokens = 0
    total_duration = 0
    
    for step_name, step_result in result.items():
        if isinstance(step_result, dict) and '_metadata' in step_result:
            meta = step_result['_metadata']
            total_tokens += meta.get('tokens_used', 0)
            total_duration += meta.get('duration_ms', 0)
            # Remove metadata from result before saving
            del step_result['_metadata']
    
    ai_output_data = {
        "request_id": request_id,
        "version": version,
        "summary": json.dumps(result),  # Store all workflow results
        "topic": None,  # Deprecated field
        "sensitivity_score": None,  # Deprecated field
        "redactions_json": None,  # Deprecated field
        "custom_instructions": None,  # Deprecated field - now handled per-block
        "model_name": settings.model_name,
        "tokens_used": total_tokens,
        "duration_ms": total_duration
    }
    
    # Save to database via backend API
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{settings.backend_api_url}/api/internal/ai-outputs",
            json=ai_output_data
        )
        response.raise_for_status()
    
    logger.info("AI output saved successfully", 
               request_id=request_id, 
               version=version,
               tokens_used=total_tokens,
               duration_ms=total_duration)

@app.get("/healthz")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Ollama connection
        import ollama
        client = ollama.AsyncClient(host=settings.ollama_host)
        await client.list()
        
        return {"status": "healthy", "service": "taskflow-ai", "ollama": "connected"}
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=503, detail="Service unhealthy")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "worker:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False
    )