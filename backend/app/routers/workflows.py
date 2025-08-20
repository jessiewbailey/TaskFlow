from typing import Optional

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.database import get_db
from app.models.pydantic_models import (
    CreateWorkflowRequest,
    DashboardConfigRequest,
    DashboardConfigResponse,
    UpdateWorkflowRequest,
    WorkflowBlockInputResponse,
    WorkflowBlockResponse,
    WorkflowListResponse,
    WorkflowResponse,
)
from app.models.schemas import (
    BlockInputType,
    BlockType,
    DashboardLayout,
    Workflow,
    WorkflowBlock,
    WorkflowBlockInput,
    WorkflowDashboardConfig,
    WorkflowStatus,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("/ollama/models")
async def get_available_models():
    """Get available models from Ollama"""
    import os

    try:
        ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ollama_host}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("models", []):
                    models.append(
                        {
                            "name": model["name"],
                            "size": model.get("size", 0),
                            "modified_at": model.get("modified_at"),
                            "digest": model.get("digest"),
                            "details": model.get("details", {}),
                        }
                    )
                return {"models": models, "total": len(models)}
            else:
                return {
                    "models": [],
                    "total": 0,
                    "error": "Failed to fetch models from Ollama",
                }
    except Exception as e:
        logger.error("Error fetching Ollama models", error=str(e))
        return {"models": [], "total": 0, "error": str(e)}


@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    status: Optional[WorkflowStatus] = Query(None, description="Filter by status"),
    default_only: bool = Query(False, description="Show only default workflows"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db),
):
    """List workflows with pagination"""

    # Build query
    query = select(Workflow).options(
        selectinload(Workflow.blocks).selectinload(WorkflowBlock.inputs)
    )

    # Apply filters
    if status is not None:
        query = query.where(Workflow.status == status)

    if default_only:
        query = query.where(Workflow.is_default)

    # Apply sorting
    query = query.order_by(Workflow.updated_at.desc())

    # Get total count
    count_query = select(func.count(Workflow.id))
    if status is not None:
        count_query = count_query.where(Workflow.status == status)
    if default_only:
        count_query = count_query.where(Workflow.is_default)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    workflows = result.scalars().all()

    # Convert to response format
    workflow_responses = []
    for workflow in workflows:
        blocks = []
        for block in sorted(workflow.blocks, key=lambda x: x.order):
            inputs = [
                WorkflowBlockInputResponse(
                    id=inp.id,
                    input_type=inp.input_type.value,
                    source_block_id=inp.source_block_id,
                    variable_name=inp.variable_name,
                )
                for inp in block.inputs
            ]
            blocks.append(
                WorkflowBlockResponse(
                    id=block.id,
                    workflow_id=block.workflow_id,
                    name=block.name,
                    prompt=block.prompt,
                    system_prompt=block.system_prompt,
                    order=block.order,
                    block_type=block.block_type.value,
                    output_schema=block.output_schema,
                    model_name=block.model_name,
                    model_parameters=block.model_parameters,
                    inputs=inputs,
                    created_at=block.created_at,
                    updated_at=block.updated_at,
                )
            )

        workflow_responses.append(
            WorkflowResponse(
                id=workflow.id,
                name=workflow.name,
                description=workflow.description,
                status=workflow.status.value,
                is_default=workflow.is_default,
                created_by=workflow.created_by,
                blocks=blocks,
                created_at=workflow.created_at,
                updated_at=workflow.updated_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return WorkflowListResponse(
        workflows=workflow_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/default", response_model=WorkflowResponse)
async def get_default_workflow(db: AsyncSession = Depends(get_db)):
    """Get the current default workflow"""

    query = (
        select(Workflow)
        .options(selectinload(Workflow.blocks).selectinload(WorkflowBlock.inputs))
        .where(Workflow.is_default)
    )

    result = await db.execute(query)
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(status_code=404, detail="No default workflow found")

    # Convert blocks to response format
    blocks = []
    for block in workflow.blocks:
        inputs = [
            WorkflowBlockInputResponse(
                id=inp.id,
                input_type=inp.input_type.value,
                source_block_id=inp.source_block_id,
                variable_name=inp.variable_name,
            )
            for inp in block.inputs
        ]

        blocks.append(
            WorkflowBlockResponse(
                id=block.id,
                workflow_id=block.workflow_id,
                name=block.name,
                prompt=block.prompt,
                system_prompt=block.system_prompt,
                order=block.order,
                block_type=block.block_type.value,
                output_schema=block.output_schema,
                model_name=block.model_name,
                model_parameters=block.model_parameters,
                inputs=inputs,
                created_at=block.created_at,
                updated_at=block.updated_at,
            )
        )

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status.value,
        is_default=workflow.is_default,
        created_by=workflow.created_by,
        blocks=blocks,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )


@router.post("", response_model=WorkflowResponse)
async def create_workflow(workflow: CreateWorkflowRequest, db: AsyncSession = Depends(get_db)):
    """Create a new workflow"""

    # For now, use a default user ID of 1
    # In a real implementation, this would come from authentication
    created_by = 1

    # If setting as default, unset all other default workflows
    if workflow.is_default:
        await db.execute(select(Workflow).where(Workflow.is_default))
        existing_defaults = await db.execute(select(Workflow).where(Workflow.is_default))
        for existing_default in existing_defaults.scalars():
            existing_default.is_default = False
        await db.flush()

    # Create workflow
    db_workflow = Workflow(
        name=workflow.name,
        description=workflow.description,
        status=WorkflowStatus.DRAFT,
        is_default=workflow.is_default,
        created_by=created_by,
    )

    db.add(db_workflow)
    await db.flush()  # Get the ID

    # Create blocks first, then inputs (to handle block references)
    created_blocks = []

    logger.info(f"Creating workflow with {len(workflow.blocks)} blocks")

    # Create all blocks first
    for block_data in workflow.blocks:
        db_block = WorkflowBlock(
            workflow_id=db_workflow.id,
            name=block_data.name,
            prompt=block_data.prompt,
            system_prompt=block_data.system_prompt,
            order=block_data.order,
            block_type=(
                BlockType(block_data.block_type) if block_data.block_type else BlockType.CORE
            ),
            output_schema=block_data.output_schema,
            model_name=block_data.model_name,
            model_parameters=block_data.model_parameters,
        )
        db.add(db_block)
        await db.flush()  # Get the block ID
        created_blocks.append(db_block)

    # Now create inputs with proper block ID mapping
    for block_index, block_data in enumerate(workflow.blocks):
        db_block = created_blocks[block_index]

        for input_data in block_data.inputs:
            try:
                # Map array index to actual database ID
                source_block_id = None
                if (
                    input_data.source_block_id is not None
                    and input_data.input_type == "BLOCK_OUTPUT"
                ):
                    if 0 <= input_data.source_block_id < len(created_blocks):
                        source_block_id = created_blocks[input_data.source_block_id].id
                        logger.info(
                            f"Mapped source_block_id {input_data.source_block_id} "
                            f"to database ID {source_block_id}"
                        )
                    else:
                        # Invalid block index, skip this input
                        logger.warning(
                            f"Invalid source_block_id {input_data.source_block_id} "
                            f"for block {block_index}"
                        )
                        continue

                db_input = WorkflowBlockInput(
                    block_id=db_block.id,
                    input_type=BlockInputType(input_data.input_type),
                    source_block_id=source_block_id,
                    variable_name=input_data.variable_name,
                )
                db.add(db_input)
            except Exception as e:
                logger.error(f"Error creating input for block {block_index}: {str(e)}")
                raise

    await db.commit()

    # Fetch the created workflow with relationships
    query = (
        select(Workflow)
        .options(selectinload(Workflow.blocks).selectinload(WorkflowBlock.inputs))
        .where(Workflow.id == db_workflow.id)
    )

    result = await db.execute(query)
    created_workflow = result.scalar_one()

    logger.info("Created workflow", workflow_id=db_workflow.id, name=workflow.name)

    # Convert to response
    return await _workflow_to_response(created_workflow)


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get detailed workflow information"""

    query = (
        select(Workflow)
        .options(selectinload(Workflow.blocks).selectinload(WorkflowBlock.inputs))
        .where(Workflow.id == workflow_id)
    )

    result = await db.execute(query)
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    return await _workflow_to_response(workflow)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: int,
    workflow_update: UpdateWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update a workflow"""

    # Get existing workflow
    query = (
        select(Workflow)
        .options(selectinload(Workflow.blocks).selectinload(WorkflowBlock.inputs))
        .where(Workflow.id == workflow_id)
    )

    result = await db.execute(query)
    db_workflow = result.scalar_one_or_none()

    if not db_workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Update basic fields
    if workflow_update.name is not None:
        db_workflow.name = workflow_update.name
    if workflow_update.description is not None:
        db_workflow.description = workflow_update.description
    if workflow_update.status is not None:
        db_workflow.status = WorkflowStatus(workflow_update.status)
    if workflow_update.is_default is not None:
        # If setting this workflow as default, unset all other defaults first
        if workflow_update.is_default:
            # Update all other workflows to not be default
            from sqlalchemy import update

            await db.execute(
                update(Workflow).where(Workflow.id != workflow_id).values(is_default=False)
            )
            await db.flush()
        db_workflow.is_default = workflow_update.is_default

    # Update blocks if provided
    if workflow_update.blocks is not None:
        # Get existing blocks to preserve core block schemas
        existing_blocks_result = await db.execute(
            select(WorkflowBlock).where(WorkflowBlock.workflow_id == workflow_id)
        )
        existing_blocks = {block.name: block for block in existing_blocks_result.scalars().all()}

        # Delete existing blocks
        await db.execute(delete(WorkflowBlock).where(WorkflowBlock.workflow_id == workflow_id))

        # Create new blocks - first pass to create all blocks
        created_blocks = []
        for block_data in workflow_update.blocks:
            # For core blocks, preserve the original schema if it exists
            output_schema = block_data.output_schema
            if block_data.block_type == "CORE":
                existing_block = existing_blocks.get(block_data.name)
                if existing_block and existing_block.output_schema:
                    output_schema = existing_block.output_schema

            db_block = WorkflowBlock(
                workflow_id=workflow_id,
                name=block_data.name,
                prompt=block_data.prompt,
                system_prompt=block_data.system_prompt,
                order=block_data.order,
                block_type=BlockType(block_data.block_type),
                output_schema=output_schema,
                model_name=block_data.model_name,
                model_parameters=block_data.model_parameters,
            )
            db.add(db_block)
            await db.flush()
            created_blocks.append(db_block)

        # Second pass to create inputs with proper block ID mapping
        for block_index, block_data in enumerate(workflow_update.blocks):
            db_block = created_blocks[block_index]

            for input_data in block_data.inputs:
                # Map array index to actual database ID
                source_block_id = None
                if (
                    input_data.source_block_id is not None
                    and input_data.input_type == "BLOCK_OUTPUT"
                ):
                    if 0 <= input_data.source_block_id < len(created_blocks):
                        source_block_id = created_blocks[input_data.source_block_id].id
                        logger.info(
                            f"Update: Mapped source_block_id {input_data.source_block_id} "
                            f"to database ID {source_block_id}"
                        )
                    else:
                        # Invalid block index, skip this input
                        logger.warning(
                            f"Update: Invalid source_block_id {input_data.source_block_id} "
                            f"for block {block_index}"
                        )
                        continue

                db_input = WorkflowBlockInput(
                    block_id=db_block.id,
                    input_type=BlockInputType(input_data.input_type),
                    source_block_id=source_block_id,
                    variable_name=input_data.variable_name,
                )
                db.add(db_input)

    await db.commit()

    # Fetch the updated workflow with relationships
    query = (
        select(Workflow)
        .options(selectinload(Workflow.blocks).selectinload(WorkflowBlock.inputs))
        .where(Workflow.id == workflow_id)
    )

    result = await db.execute(query)
    updated_workflow = result.scalar_one()

    logger.info("Updated workflow", workflow_id=workflow_id)

    return await _workflow_to_response(updated_workflow)


@router.get("/{workflow_id}/dashboard", response_model=DashboardConfigResponse)
async def get_dashboard_config(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get dashboard configuration for a workflow"""

    result = await db.execute(
        select(WorkflowDashboardConfig).where(WorkflowDashboardConfig.workflow_id == workflow_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")

    return config


@router.post("/{workflow_id}/dashboard", response_model=DashboardConfigResponse)
async def create_or_update_dashboard_config(
    workflow_id: int,
    dashboard_config: DashboardConfigRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create or update dashboard configuration for a workflow"""

    # Check if workflow exists
    workflow_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Check if config already exists
    existing_result = await db.execute(
        select(WorkflowDashboardConfig).where(WorkflowDashboardConfig.workflow_id == workflow_id)
    )
    existing_config = existing_result.scalar_one_or_none()

    if existing_config:
        # Update existing config
        existing_config.fields = [field.dict() for field in dashboard_config.fields]
        existing_config.layout = DashboardLayout(dashboard_config.layout)
        await db.commit()
        await db.refresh(existing_config)
        return existing_config
    else:
        # Create new config
        new_config = WorkflowDashboardConfig(
            workflow_id=workflow_id,
            fields=[field.dict() for field in dashboard_config.fields],
            layout=DashboardLayout(dashboard_config.layout),
        )
        db.add(new_config)
        await db.commit()
        await db.refresh(new_config)
        return new_config


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a workflow"""

    # Verify workflow exists
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Delete workflow (cascade will handle blocks and inputs)
    await db.delete(workflow)
    await db.commit()

    logger.info("Deleted workflow", workflow_id=workflow_id)

    return {"message": "Workflow deleted successfully"}


async def _workflow_to_response(workflow: Workflow) -> WorkflowResponse:
    """Convert workflow to response format"""
    blocks = []
    for block in sorted(workflow.blocks, key=lambda x: x.order):
        inputs = [
            WorkflowBlockInputResponse(
                id=inp.id,
                input_type=inp.input_type.value,
                source_block_id=inp.source_block_id,
                variable_name=inp.variable_name,
            )
            for inp in block.inputs
        ]
        blocks.append(
            WorkflowBlockResponse(
                id=block.id,
                workflow_id=block.workflow_id,
                name=block.name,
                prompt=block.prompt,
                system_prompt=block.system_prompt,
                order=block.order,
                block_type=block.block_type.value,
                output_schema=block.output_schema,
                model_name=block.model_name,
                model_parameters=block.model_parameters,
                inputs=inputs,
                created_at=block.created_at,
                updated_at=block.updated_at,
            )
        )

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        description=workflow.description,
        status=workflow.status.value,
        is_default=workflow.is_default,
        created_by=workflow.created_by,
        blocks=blocks,
        created_at=workflow.created_at,
        updated_at=workflow.updated_at,
    )
