from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.pydantic_models import (CustomInstructionRequest,
                                        CustomInstructionResponse,
                                        CustomInstructionUpdateRequest)
from app.models.schemas import CustomInstruction, Request, WorkflowBlock

logger = structlog.get_logger()
router = APIRouter(prefix="/api/requests", tags=["custom-instructions"])


@router.get(
    "/{request_id}/custom-instructions", response_model=List[CustomInstructionResponse]
)
async def list_custom_instructions(request_id: int, db: AsyncSession = Depends(get_db)):
    """Get all custom instructions for a request"""

    # Verify request exists
    request_result = await db.execute(select(Request).where(Request.id == request_id))
    request = request_result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Get custom instructions with related data
    result = await db.execute(
        select(CustomInstruction, WorkflowBlock.name.label("workflow_block_name"))
        .join(WorkflowBlock, CustomInstruction.workflow_block_id == WorkflowBlock.id)
        .where(CustomInstruction.request_id == request_id)
        .where(CustomInstruction.is_active == True)
        .order_by(CustomInstruction.created_at.desc())
    )

    instructions = []
    for instruction, block_name in result.all():
        instruction_data = CustomInstructionResponse.from_orm(instruction)
        instruction_data.workflow_block_name = block_name
        instructions.append(instruction_data)

    return instructions


@router.post(
    "/{request_id}/custom-instructions", response_model=CustomInstructionResponse
)
async def create_custom_instruction(
    request_id: int,
    instruction: CustomInstructionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new custom instruction for a specific workflow block"""

    # Verify request exists
    request_result = await db.execute(select(Request).where(Request.id == request_id))
    request_obj = request_result.scalar_one_or_none()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify workflow block exists
    block_result = await db.execute(
        select(WorkflowBlock).where(WorkflowBlock.id == instruction.workflow_block_id)
    )
    block = block_result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Workflow block not found")

    # Check if instruction already exists for this request/block
    existing_result = await db.execute(
        select(CustomInstruction)
        .where(CustomInstruction.request_id == request_id)
        .where(CustomInstruction.workflow_block_id == instruction.workflow_block_id)
        .where(CustomInstruction.is_active == True)
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Update existing instruction
        existing.instruction_text = instruction.instruction_text
        existing.updated_at = func.current_timestamp()
        await db.commit()
        await db.refresh(existing)

        # Get the response with block name
        response_data = CustomInstructionResponse.from_orm(existing)
        response_data.workflow_block_name = block.name

        logger.info(
            "Updated existing custom instruction",
            request_id=request_id,
            block_id=instruction.workflow_block_id,
        )

        return response_data
    else:
        # Create new instruction
        db_instruction = CustomInstruction(
            request_id=request_id,
            workflow_block_id=instruction.workflow_block_id,
            instruction_text=instruction.instruction_text,
            created_by=1,  # TODO: Get from auth context
        )

        db.add(db_instruction)
        await db.commit()
        await db.refresh(db_instruction)

        # Get the response with block name
        response_data = CustomInstructionResponse.from_orm(db_instruction)
        response_data.workflow_block_name = block.name

        logger.info(
            "Created new custom instruction",
            request_id=request_id,
            block_id=instruction.workflow_block_id,
        )

        return response_data


@router.put(
    "/{request_id}/custom-instructions/{instruction_id}",
    response_model=CustomInstructionResponse,
)
async def update_custom_instruction(
    request_id: int,
    instruction_id: int,
    update_data: CustomInstructionUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing custom instruction"""

    # Get the instruction
    result = await db.execute(
        select(CustomInstruction, WorkflowBlock.name.label("workflow_block_name"))
        .join(WorkflowBlock, CustomInstruction.workflow_block_id == WorkflowBlock.id)
        .where(CustomInstruction.id == instruction_id)
        .where(CustomInstruction.request_id == request_id)
    )
    instruction_data = result.first()

    if not instruction_data:
        raise HTTPException(status_code=404, detail="Custom instruction not found")

    instruction, block_name = instruction_data

    # Update fields
    if update_data.instruction_text is not None:
        instruction.instruction_text = update_data.instruction_text
    if update_data.is_active is not None:
        instruction.is_active = update_data.is_active

    await db.commit()
    await db.refresh(instruction)

    response_data = CustomInstructionResponse.from_orm(instruction)
    response_data.workflow_block_name = block_name

    logger.info(
        "Updated custom instruction",
        instruction_id=instruction_id,
        request_id=request_id,
    )

    return response_data


@router.delete("/{request_id}/custom-instructions/{instruction_id}")
async def delete_custom_instruction(
    request_id: int, instruction_id: int, db: AsyncSession = Depends(get_db)
):
    """Delete (deactivate) a custom instruction"""

    # Get the instruction
    result = await db.execute(
        select(CustomInstruction)
        .where(CustomInstruction.id == instruction_id)
        .where(CustomInstruction.request_id == request_id)
    )
    instruction = result.scalar_one_or_none()

    if not instruction:
        raise HTTPException(status_code=404, detail="Custom instruction not found")

    # Soft delete by setting is_active to False
    instruction.is_active = False
    await db.commit()

    logger.info(
        "Deleted custom instruction",
        instruction_id=instruction_id,
        request_id=request_id,
    )

    return {"message": "Custom instruction deleted successfully"}
