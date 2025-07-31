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
    yield
    # Shutdown
    logger.info("Shutting down TaskFlow AI Worker service")

app = FastAPI(
    title="TaskFlow AI Worker", 
    description="AI processing service for document requests",
    version="1.0.0",
    lifespan=lifespan
)

class ProcessRequest(BaseModel):
    request_id: int
    workflow_id: int

@app.post("/process")
async def process_request(request: ProcessRequest):
    """Process a document request using AI pipeline"""
    
    logger.info("Received processing request", 
                request_id=request.request_id, 
                workflow_id=request.workflow_id)
    
    try:
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
        
        # Initialize workflow processor
        workflow_processor = WorkflowProcessor()
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
        
        return {"status": "completed", "version": version}
        
    except Exception as e:
        logger.error("Processing failed", 
                    request_id=request.request_id, 
                    error=str(e), 
                    exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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