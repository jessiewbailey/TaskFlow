"""Test workflow embedding configuration functionality"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import Workflow, WorkflowEmbeddingConfig


@pytest.mark.asyncio
async def test_create_embedding_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test creating an embedding configuration for a workflow"""

    # Create a workflow first
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow for embedding config",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Create embedding config
    config_data = {
        "enabled": True,
        "embedding_template": "Request: {request_text}\n\nAnalysis:\n{block_summarize_request}",
    }

    response = await client.post(
        f"/api/workflows/{workflow.id}/embedding-config",
        json=config_data,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["workflow_id"] == workflow.id
    assert data["enabled"] is True
    assert "Analysis:" in data["embedding_template"]

    # Verify in database
    result = await db_session.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow.id
        )
    )
    config = result.scalar_one()
    assert config is not None
    assert config.enabled is True


@pytest.mark.asyncio
async def test_update_embedding_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test updating an existing embedding configuration"""

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
    config = WorkflowEmbeddingConfig(
        workflow_id=workflow.id, enabled=False, embedding_template="Simple template"
    )
    db_session.add(config)
    await db_session.commit()

    # Update config
    new_config_data = {
        "enabled": True,
        "embedding_template": "Updated template with {request_text} and {workflow_output}",
    }

    response = await client.post(
        f"/api/workflows/{workflow.id}/embedding-config",
        json=new_config_data,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is True
    assert "Updated template" in data["embedding_template"]

    # Verify only one config exists
    result = await db_session.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow.id
        )
    )
    configs = result.scalars().all()
    assert len(configs) == 1
    assert configs[0].enabled is True


@pytest.mark.asyncio
async def test_get_embedding_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test retrieving embedding configuration"""

    # Create workflow with config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    config = WorkflowEmbeddingConfig(
        workflow_id=workflow.id, enabled=True, embedding_template="Test template"
    )
    db_session.add(config)
    await db_session.commit()

    # Get config
    response = await client.get(
        f"/api/workflows/{workflow.id}/embedding-config", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["workflow_id"] == workflow.id
    assert data["enabled"] is True


@pytest.mark.asyncio
async def test_get_nonexistent_embedding_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test retrieving embedding config for workflow without one"""

    # Create workflow without config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Get config - should return default disabled config
    response = await client.get(
        f"/api/workflows/{workflow.id}/embedding-config", headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False
    assert data["embedding_template"] == ""


@pytest.mark.asyncio
async def test_disable_embedding_config(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test disabling embedding generation"""

    # Create workflow with enabled config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    config = WorkflowEmbeddingConfig(
        workflow_id=workflow.id, enabled=True, embedding_template="Test template"
    )
    db_session.add(config)
    await db_session.commit()

    # Disable config
    response = await client.post(
        f"/api/workflows/{workflow.id}/embedding-config",
        json={"enabled": False, "embedding_template": ""},
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["enabled"] is False


@pytest.mark.asyncio
async def test_embedding_config_template_variables(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test embedding config with various template variables"""

    # Create workflow
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Create config with multiple template variables
    config_data = {
        "enabled": True,
        "embedding_template": """
Request ID: {request_id}
Request Text: {request_text}
Full Output: {workflow_output}
Block 1: {block_summarize_request}
Block 2: {block_categorize_request}
        """,
    }

    response = await client.post(
        f"/api/workflows/{workflow.id}/embedding-config",
        json=config_data,
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert "{request_id}" in data["embedding_template"]
    assert "{block_summarize_request}" in data["embedding_template"]


@pytest.mark.asyncio
async def test_embedding_config_cascade_delete(db_session: AsyncSession):
    """Test that embedding config is deleted when workflow is deleted"""

    # Create workflow with config
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    config = WorkflowEmbeddingConfig(
        workflow_id=workflow.id, enabled=True, embedding_template="Test"
    )
    db_session.add(config)
    await db_session.commit()

    # Verify config exists
    result = await db_session.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow.id
        )
    )
    assert result.scalar_one_or_none() is not None

    # Delete workflow
    await db_session.delete(workflow)
    await db_session.commit()

    # Verify config was deleted
    result = await db_session.execute(
        select(WorkflowEmbeddingConfig).where(
            WorkflowEmbeddingConfig.workflow_id == workflow.id
        )
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_embedding_config_validation(
    client: AsyncClient, db_session: AsyncSession, auth_headers: dict
):
    """Test embedding configuration validation"""

    # Create workflow
    workflow = Workflow(
        name="Test Workflow",
        description="Test workflow",
        is_default=False,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.commit()

    # Test with missing enabled field
    response = await client.post(
        f"/api/workflows/{workflow.id}/embedding-config",
        json={"embedding_template": "Test"},
        headers=auth_headers,
    )
    assert response.status_code == 422

    # Test with invalid workflow ID
    response = await client.post(
        "/api/workflows/99999/embedding-config",
        json={"enabled": True, "embedding_template": "Test"},
        headers=auth_headers,
    )
    assert response.status_code == 404
