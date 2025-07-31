from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import get_db
from app.models.schemas import Request, AIOutput
from app.models.pydantic_models import AIOutputResponse
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