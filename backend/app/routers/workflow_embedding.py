from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.pydantic_models import (WorkflowEmbeddingConfigCreate,
                                        WorkflowEmbeddingConfigResponse,
                                        WorkflowEmbeddingConfigUpdate,
                                        WorkflowSimilarityConfigCreate,
                                        WorkflowSimilarityConfigResponse,
                                        WorkflowSimilarityConfigUpdate)
from app.models.schemas import (Workflow, WorkflowEmbeddingConfig,
                                WorkflowSimilarityConfig)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/workflows", tags=["workflow-embedding"])

# Embedding Configuration Endpoints


@router.get(
    "/{workflow_id}/embedding-config",
    response_model=Optional[WorkflowEmbeddingConfigResponse],
)
async def get_embedding_config(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get embedding configuration for a workflow"""
    # Verify workflow exists
    workflow_result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Get embedding config
    result = await db.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow_id
        )
    )
    config = result.scalar_one_or_none()

    if config:
        return WorkflowEmbeddingConfigResponse.from_orm(config)
    return None


@router.post(
    "/{workflow_id}/embedding-config", response_model=WorkflowEmbeddingConfigResponse
)
async def create_or_update_embedding_config(
    workflow_id: int,
    config_data: WorkflowEmbeddingConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create or update embedding configuration for a workflow"""
    # Verify workflow exists
    workflow_result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Check if config exists
    result = await db.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow_id
        )
    )
    existing_config = result.scalar_one_or_none()

    if existing_config:
        # Update existing
        existing_config.enabled = config_data.enabled
        existing_config.embedding_template = config_data.embedding_template
    else:
        # Create new
        existing_config = WorkflowEmbeddingConfig(
            workflow_id=workflow_id,
            enabled=config_data.enabled,
            embedding_template=config_data.embedding_template,
        )
        db.add(existing_config)

    await db.commit()
    await db.refresh(existing_config)

    logger.info(
        "Embedding config saved", workflow_id=workflow_id, config_id=existing_config.id
    )
    return WorkflowEmbeddingConfigResponse.from_orm(existing_config)


@router.patch(
    "/{workflow_id}/embedding-config", response_model=WorkflowEmbeddingConfigResponse
)
async def update_embedding_config(
    workflow_id: int,
    config_data: WorkflowEmbeddingConfigUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update embedding configuration for a workflow"""
    # Get existing config
    result = await db.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow_id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")

    # Update fields
    if config_data.enabled is not None:
        config.enabled = config_data.enabled
    if config_data.embedding_template is not None:
        config.embedding_template = config_data.embedding_template

    await db.commit()
    await db.refresh(config)

    return WorkflowEmbeddingConfigResponse.from_orm(config)


@router.delete("/{workflow_id}/embedding-config")
async def delete_embedding_config(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Delete embedding configuration for a workflow"""
    result = await db.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow_id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Embedding configuration not found")

    await db.delete(config)
    await db.commit()

    return {"message": "Embedding configuration deleted"}


# Similarity Display Configuration Endpoints


@router.get(
    "/{workflow_id}/similarity-config",
    response_model=Optional[WorkflowSimilarityConfigResponse],
)
async def get_similarity_config(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get similarity display configuration for a workflow"""
    # Verify workflow exists
    workflow_result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Get similarity config
    result = await db.execute(
        select(WorkflowSimilarityConfig).where(
            WorkflowSimilarityConfig.workflow_id == workflow_id
        )
    )
    config = result.scalar_one_or_none()

    if config:
        return WorkflowSimilarityConfigResponse.from_orm(config)
    return None


@router.post(
    "/{workflow_id}/similarity-config", response_model=WorkflowSimilarityConfigResponse
)
async def create_or_update_similarity_config(
    workflow_id: int,
    config_data: WorkflowSimilarityConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create or update similarity display configuration for a workflow"""
    # Verify workflow exists
    workflow_result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id)
    )
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Check if config exists
    result = await db.execute(
        select(WorkflowSimilarityConfig).where(
            WorkflowSimilarityConfig.workflow_id == workflow_id
        )
    )
    existing_config = result.scalar_one_or_none()

    if existing_config:
        # Update existing
        existing_config.fields = [field.dict() for field in config_data.fields]
    else:
        # Create new
        existing_config = WorkflowSimilarityConfig(
            workflow_id=workflow_id,
            fields=[field.dict() for field in config_data.fields],
        )
        db.add(existing_config)

    await db.commit()
    await db.refresh(existing_config)

    logger.info(
        "Similarity config saved", workflow_id=workflow_id, config_id=existing_config.id
    )
    return WorkflowSimilarityConfigResponse.from_orm(existing_config)


@router.delete("/{workflow_id}/similarity-config")
async def delete_similarity_config(
    workflow_id: int, db: AsyncSession = Depends(get_db)
):
    """Delete similarity display configuration for a workflow"""
    result = await db.execute(
        select(WorkflowSimilarityConfig).where(
            WorkflowSimilarityConfig.workflow_id == workflow_id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=404, detail="Similarity configuration not found"
        )

    await db.delete(config)
    await db.commit()

    return {"message": "Similarity configuration deleted"}
