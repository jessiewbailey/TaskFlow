from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db
from app.models.schemas import Request, AIOutput, EmbeddingStatus
from app.models.pydantic_models import AIOutputResponse, EmbeddingStatus as EmbeddingStatusEnum
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/internal", tags=["internal"])

class CreateAIOutputRequest(BaseModel):
    request_id: int
    version: int
    summary: Optional[str]  # JSON string containing all workflow outputs
    model_name: Optional[str]
    tokens_used: Optional[int]
    duration_ms: Optional[int]

@router.post("/ai-outputs", response_model=AIOutputResponse)
async def create_ai_output(
    ai_output: CreateAIOutputRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create AI output record (internal API for AI worker)"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == ai_output.request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Create AI output
    output = AIOutput(
        request_id=ai_output.request_id,
        version=ai_output.version,
        summary=ai_output.summary,
        model_name=ai_output.model_name,
        tokens_used=ai_output.tokens_used,
        duration_ms=ai_output.duration_ms
    )
    
    db.add(output)
    await db.commit()
    await db.refresh(output)
    
    logger.info("AI output created", 
               request_id=ai_output.request_id, 
               version=ai_output.version,
               ai_output_id=output.id)
    
    return AIOutputResponse.from_orm(output)

class UpdateEmbeddingStatusRequest(BaseModel):
    embedding_status: str

@router.patch("/requests/{request_id}/embedding-status")
async def update_embedding_status(
    request_id: int,
    status_update: UpdateEmbeddingStatusRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update embedding status for a request (internal API for AI worker)"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update embedding status
    try:
        request.embedding_status = EmbeddingStatus(status_update.embedding_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid embedding status: {status_update.embedding_status}")
    
    await db.commit()
    
    logger.info("Embedding status updated", 
               request_id=request_id, 
               status=status_update.embedding_status)
    
    return {"message": "Embedding status updated successfully"}

class EmbeddingCompleteCallback(BaseModel):
    request_id: int
    embedding_id: str
    status: str

@router.post("/callbacks/embedding-complete")
async def embedding_complete_callback(
    callback: EmbeddingCompleteCallback,
    db: AsyncSession = Depends(get_db)
):
    """Handle callback when embedding generation is complete"""
    
    logger.info("Received embedding completion callback", 
               request_id=callback.request_id, 
               embedding_id=callback.embedding_id,
               status=callback.status)
    
    # Here you could add additional logic like:
    # - Triggering dependent jobs
    # - Sending notifications
    # - Updating metrics
    
    return {"message": "Callback processed successfully"}