"""Test workflow similarity configuration functionality"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import Workflow, WorkflowSimilarityConfig


@pytest.mark.asyncio
async def test_create_similarity_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test creating a similarity configuration for a workflow"""

    # Create a workflow first
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow for similarity config",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Create similarity config
    config_data = {
        "fields": [
            {
                "name": "summary",
                "source": "block_output",
                "block_name": "Summarize Request",
                "json_path": "summary",
            },
            {"name": "priority", "source": "request_field", "field_name": "priority"},
        ]
    }

    response = await client.post(
        f"/api/workflows/{workflow.id}/similarity-config",
        json=config_data,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["workflow_id"] == workflow.id
    assert len(data["fields"]) == 2
    assert data["fields"][0]["name"] == "summary"
    assert data["fields"][1]["name"] == "priority"

    # Verify in database
    result = await db_session.execute(
        select(WorkflowSimilarityConfig).where(WorkflowSimilarityConfig.workflow_id == workflow.id)
    )
    config = result.scalar_one()
    assert config is not None
    assert len(config.fields) == 2


@pytest.mark.asyncio
async def test_update_similarity_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test updating an existing similarity configuration"""

    # Create workflow with initial config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    # Create initial config
    config = WorkflowSimilarityConfig(
        workflow_id=workflow.id, fields=[{"name": "summary", "source": "block_output"}]
    )
    db_session.add(config)
    await db_session.commit()

    # Update config
    new_config_data = {
        "fields": [
            {
                "name": "summary",
                "source": "block_output",
                "block_name": "Summarize Request",
            },
            {
                "name": "category",
                "source": "block_output",
                "block_name": "Categorize Request",
            },
            {"name": "status", "source": "request_field", "field_name": "status"},
        ]
    }

    response = await client.post(
        f"/api/workflows/{workflow.id}/similarity-config",
        json=new_config_data,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["fields"]) == 3

    # Verify only one config exists
    result = await db_session.execute(
        select(WorkflowSimilarityConfig).where(WorkflowSimilarityConfig.workflow_id == workflow.id)
    )
    configs = result.scalars().all()
    assert len(configs) == 1
    assert len(configs[0].fields) == 3


@pytest.mark.asyncio
async def test_get_similarity_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test retrieving similarity configuration"""

    # Create workflow with config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    config = WorkflowSimilarityConfig(
        workflow_id=workflow.id,
        fields=[
            {"name": "summary", "source": "block_output"},
            {"name": "priority", "source": "request_field"},
        ],
    )
    db_session.add(config)
    await db_session.commit()

    # Get config
    response = await client.get(
        f"/api/workflows/{workflow.id}/similarity-config", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["workflow_id"] == workflow.id
    assert len(data["fields"]) == 2


@pytest.mark.asyncio
async def test_get_nonexistent_similarity_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test retrieving similarity config for workflow without one"""

    # Create workflow without config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Get config
    response = await client.get(
        f"/api/workflows/{workflow.id}/similarity-config", headers=auth_headers
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_similarity_config_validation(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test similarity configuration validation"""

    # Create workflow
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Test empty fields
    response = await client.post(
        f"/api/workflows/{workflow.id}/similarity-config",
        json={"fields": []},
        headers=auth_headers,
    )
    assert response.status_code == 422  # Validation error

    # Test invalid field structure
    response = await client.post(
        f"/api/workflows/{workflow.id}/similarity-config",
        json={"fields": [{"name": "test"}]},  # Missing source
        headers=auth_headers,
    )
    assert response.status_code == 422

    # Test invalid source type
    response = await client.post(
        f"/api/workflows/{workflow.id}/similarity-config",
        json={"fields": [{"name": "test", "source": "invalid_source"}]},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_similarity_config_with_nested_json_path(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test similarity config with nested JSON path extraction"""

    # Create workflow
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Create config with nested JSON path
    config_data = {
        "fields": [
            {
                "name": "category",
                "source": "block_output",
                "block_name": "Analyze Request",
                "json_path": "analysis.category",
            },
            {
                "name": "risk_level",
                "source": "block_output",
                "block_name": "Risk Assessment",
                "json_path": "risk.level",
            },
        ]
    }

    response = await client.post(
        f"/api/workflows/{workflow.id}/similarity-config",
        json=config_data,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["fields"][0]["json_path"] == "analysis.category"
    assert data["fields"][1]["json_path"] == "risk.level"


@pytest.mark.asyncio
async def test_similarity_config_cascade_delete(db_session: AsyncSession):
    """Test that similarity config is deleted when workflow is deleted"""

    # Create workflow with config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    config = WorkflowSimilarityConfig(
        workflow_id=workflow.id, fields=[{"name": "test", "source": "block_output"}]
    )
    db_session.add(config)
    await db_session.commit()

    # Verify config exists
    result = await db_session.execute(
        select(WorkflowSimilarityConfig).where(WorkflowSimilarityConfig.workflow_id == workflow.id)
    )
    assert result.scalar_one_or_none() is not None

    # Delete workflow
    await db_session.delete(workflow)
    await db_session.commit()

    # Verify config was deleted
    result = await db_session.execute(
        select(WorkflowSimilarityConfig).where(WorkflowSimilarityConfig.workflow_id == workflow.id)
    )
    assert result.scalar_one_or_none() is None
