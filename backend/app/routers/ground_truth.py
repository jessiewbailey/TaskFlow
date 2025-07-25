from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from app.models.database import get_db
from app.models.schemas import GroundTruthData, User, WorkflowBlock
from app.models.pydantic_models import (
    CreateGroundTruthRequest, 
    UpdateGroundTruthRequest, 
    GroundTruthResponse
)
import structlog
import json

logger = structlog.get_logger()
router = APIRouter(prefix="/api/ground-truth", tags=["ground-truth"])

# For now, we'll use a hardcoded user ID. In production, get from auth
def get_current_user_id() -> int:
    return 1  # Default admin user

@router.post("", response_model=GroundTruthResponse)
async def create_ground_truth(
    ground_truth: CreateGroundTruthRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create or update ground truth data for a specific field"""
    try:
        current_user_id = get_current_user_id()
        
        # Check if ground truth already exists for this combination
        stmt = select(GroundTruthData).where(
            and_(
                GroundTruthData.request_id == ground_truth.request_id,
                GroundTruthData.workflow_block_id == ground_truth.workflow_block_id,
                GroundTruthData.field_path == ground_truth.field_path
            )
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing ground truth
            existing.ground_truth_value = ground_truth.ground_truth_value
            existing.ai_value = ground_truth.ai_value
            existing.notes = ground_truth.notes
            existing.created_by = current_user_id
            db_ground_truth = existing
        else:
            # Create new ground truth
            db_ground_truth = GroundTruthData(
                request_id=ground_truth.request_id,
                workflow_block_id=ground_truth.workflow_block_id,
                field_path=ground_truth.field_path,
                ai_value=ground_truth.ai_value,
                ground_truth_value=ground_truth.ground_truth_value,
                notes=ground_truth.notes,
                created_by=current_user_id
            )
            db.add(db_ground_truth)
        
        await db.commit()
        await db.refresh(db_ground_truth)
        
        # Get related data
        block_stmt = select(WorkflowBlock).where(WorkflowBlock.id == db_ground_truth.workflow_block_id)
        block_result = await db.execute(block_stmt)
        block = block_result.scalar_one_or_none()
        
        user_stmt = select(User).where(User.id == db_ground_truth.created_by)
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        
        return GroundTruthResponse(
            id=db_ground_truth.id,
            request_id=db_ground_truth.request_id,
            workflow_block_id=db_ground_truth.workflow_block_id,
            field_path=db_ground_truth.field_path,
            ai_value=db_ground_truth.ai_value,
            ground_truth_value=db_ground_truth.ground_truth_value,
            created_by=db_ground_truth.created_by,
            created_at=db_ground_truth.created_at,
            updated_at=db_ground_truth.updated_at,
            notes=db_ground_truth.notes,
            workflow_block_name=block.name if block else None,
            created_by_name=user.name if user else None
        )
        
    except Exception as e:
        logger.error("Failed to create ground truth", error=str(e))
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/request/{request_id}", response_model=List[GroundTruthResponse])
async def get_ground_truth_for_request(
    request_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all ground truth data for a specific request"""
    try:
        stmt = select(GroundTruthData).where(GroundTruthData.request_id == request_id)
        result = await db.execute(stmt)
        ground_truths = result.scalars().all()
        
        response_data = []
        for gt in ground_truths:
            # Get related data
            block_stmt = select(WorkflowBlock).where(WorkflowBlock.id == gt.workflow_block_id)
            block_result = await db.execute(block_stmt)
            block = block_result.scalar_one_or_none()
            
            user_stmt = select(User).where(User.id == gt.created_by)
            user_result = await db.execute(user_stmt)
            user = user_result.scalar_one_or_none()
            
            response_data.append(GroundTruthResponse(
                id=gt.id,
                request_id=gt.request_id,
                workflow_block_id=gt.workflow_block_id,
                field_path=gt.field_path,
                ai_value=gt.ai_value,
                ground_truth_value=gt.ground_truth_value,
                created_by=gt.created_by,
                created_at=gt.created_at,
                updated_at=gt.updated_at,
                notes=gt.notes,
                workflow_block_name=block.name if block else None,
                created_by_name=user.name if user else None
            ))
        
        return response_data
        
    except Exception as e:
        logger.error("Failed to get ground truth data", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/field", response_model=Optional[GroundTruthResponse])
async def get_ground_truth_for_field(
    request_id: int,
    workflow_block_id: int,
    field_path: str,
    db: AsyncSession = Depends(get_db)
):
    """Get ground truth data for a specific field"""
    try:
        stmt = select(GroundTruthData).where(
            and_(
                GroundTruthData.request_id == request_id,
                GroundTruthData.workflow_block_id == workflow_block_id,
                GroundTruthData.field_path == field_path
            )
        )
        result = await db.execute(stmt)
        ground_truth = result.scalar_one_or_none()
        
        if not ground_truth:
            return None
        
        # Get related data
        block_stmt = select(WorkflowBlock).where(WorkflowBlock.id == ground_truth.workflow_block_id)
        block_result = await db.execute(block_stmt)
        block = block_result.scalar_one_or_none()
        
        user_stmt = select(User).where(User.id == ground_truth.created_by)
        user_result = await db.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        
        return GroundTruthResponse(
            id=ground_truth.id,
            request_id=ground_truth.request_id,
            workflow_block_id=ground_truth.workflow_block_id,
            field_path=ground_truth.field_path,
            ai_value=ground_truth.ai_value,
            ground_truth_value=ground_truth.ground_truth_value,
            created_by=ground_truth.created_by,
            created_at=ground_truth.created_at,
            updated_at=ground_truth.updated_at,
            notes=ground_truth.notes,
            workflow_block_name=block.name if block else None,
            created_by_name=user.name if user else None
        )
        
    except Exception as e:
        logger.error("Failed to get ground truth data", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{ground_truth_id}")
async def delete_ground_truth(
    ground_truth_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete ground truth data"""
    try:
        stmt = select(GroundTruthData).where(GroundTruthData.id == ground_truth_id)
        result = await db.execute(stmt)
        ground_truth = result.scalar_one_or_none()
        
        if not ground_truth:
            raise HTTPException(status_code=404, detail="Ground truth not found")
        
        await db.delete(ground_truth)
        await db.commit()
        
        return {"message": "Ground truth deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete ground truth", error=str(e))
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))