from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import structlog
import asyncio
import httpx
import json
from config import settings
from domain_config.domain_config import get_domain_config
from ai_pipeline.processor import AIProcessor
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

app = FastAPI(
    title="TaskFlow AI Worker", 
    description="AI processing service for document requests",
    version="1.0.0"
)

class ProcessRequest(BaseModel):
    request_id: int
    job_type: str  # "STANDARD", "CUSTOM", or "WORKFLOW"
    custom_instructions: Optional[str] = None
    workflow_id: Optional[int] = None

@app.post("/process")
async def process_request(request: ProcessRequest):
    """Process a document request using AI pipeline"""
    
    logger.info("Received processing request", 
                request_id=request.request_id, 
                job_type=request.job_type)
    
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
        
        # Initialize AI processor
        processor = AIProcessor()
        
        # Process based on job type
        if request.job_type == "STANDARD":
            result = await processor.process_standard_pipeline(request_text)
            version = 1
        elif request.job_type == "CUSTOM":
            result = await processor.process_custom_pipeline(
                request_text, 
                request.custom_instructions or ""
            )
            # Get current version and increment
            version = await get_next_version(request.request_id)
        elif request.job_type == "WORKFLOW":
            if not request.workflow_id:
                raise ValueError("workflow_id is required for WORKFLOW job type")
            
            # Initialize workflow processor
            workflow_processor = WorkflowProcessor()
            result = await workflow_processor.execute_workflow(
                request.workflow_id, 
                request_text,
                request.request_id
            )
            # Get current version and increment
            version = await get_next_version(request.request_id)
        else:
            raise ValueError(f"Invalid job type: {request.job_type}")
        
        # Save AI output to database
        await save_ai_output(request.request_id, result, version)
        
        logger.info("Processing completed successfully", 
                   request_id=request.request_id,
                   job_type=request.job_type,
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
    metadata = {}
    total_tokens = 0
    total_duration = 0
    
    for step_name, step_result in result.items():
        if isinstance(step_result, dict) and '_metadata' in step_result:
            meta = step_result['_metadata']
            total_tokens += meta.get('tokens_used', 0)
            total_duration += meta.get('duration_ms', 0)
            # Remove metadata from result before saving
            del step_result['_metadata']
    
    # Detect if this is workflow output vs legacy output
    is_workflow_output = not any(key in result for key in ["basic_metadata", "topic_classification", "summary", "sensitivity_assessment"])
    
    if is_workflow_output:
        # New workflow-based output - store all block results in summary field
        # Extract common fields for database compatibility
        topic = None
        sensitivity_score = 0.0
        redactions = []
        
        # Try to extract topic from various block results
        for block_name, block_result in result.items():
            if isinstance(block_result, dict):
                if 'primary_topic' in block_result:
                    topic = block_result['primary_topic']
                elif 'topic' in block_result:
                    topic = block_result['topic']
                
                if 'score' in block_result and isinstance(block_result['score'], (int, float)):
                    sensitivity_score = float(block_result['score'])
                elif 'sensitivity_score' in block_result:
                    sensitivity_score = float(block_result['sensitivity_score'])
                
                if 'redaction_suggestions' in block_result:
                    redactions = block_result['redaction_suggestions']
                elif 'redactions' in block_result:
                    redactions = block_result['redactions']
        
        ai_output_data = {
            "request_id": request_id,
            "version": version,
            "summary": json.dumps(result),  # Store all workflow results
            "topic": topic,
            "sensitivity_score": sensitivity_score,
            "redactions_json": redactions,
            "custom_instructions": result.get("custom_instructions"),
            "model_name": settings.model_name,
            "tokens_used": total_tokens,
            "duration_ms": total_duration
        }
    else:
        # Legacy hardcoded pipeline output
        ai_output_data = {
            "request_id": request_id,
            "version": version,
            "summary": json.dumps(result.get("summary", {})),
            "topic": result.get("topic_classification", {}).get("primary_topic"),
            "sensitivity_score": float(result.get("sensitivity_assessment", {}).get("score", 0.0)),
            "redactions_json": result.get("redaction_suggestions", []),
            "custom_instructions": result.get("custom_instructions"),
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

# Configuration endpoints
@app.get("/config/domain")
async def get_domain_config_endpoint() -> Dict[str, Any]:
    """Get current domain configuration."""
    domain_config = get_domain_config()
    return domain_config.get_config()

@app.put("/config/domain") 
async def update_domain_config_endpoint(config: Dict[str, Any]) -> Dict[str, str]:
    """Update domain configuration."""
    domain_config = get_domain_config()
    domain_config.update_config(config)
    return {"message": "Configuration updated successfully"}

@app.get("/config/prompts/{prompt_type}")
async def get_prompt_template_endpoint(prompt_type: str) -> Dict[str, str]:
    """Get a specific prompt template."""
    domain_config = get_domain_config()
    try:
        template = domain_config.get_prompt_template(prompt_type)
        return {"prompt_type": prompt_type, "template": template}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/config/terminology")
async def get_terminology_endpoint() -> Dict[str, str]:
    """Get current domain terminology."""
    domain_config = get_domain_config()
    return domain_config.get_terminology()

@app.get("/healthz")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Ollama connection
        processor = AIProcessor()
        await processor.client.list()
        
        return {"status": "healthy", "service": "taskflow-ai", "ollama": "connected"}
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info("Starting TaskFlow AI Worker service")

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("Shutting down TaskFlow AI Worker service")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "worker:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=False
    )