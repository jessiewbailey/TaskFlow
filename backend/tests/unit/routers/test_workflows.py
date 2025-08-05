"""
Unit tests for workflow routes

Tests cover:
- Workflow CRUD operations
- Workflow validation
- Embedding configuration
- Similarity configuration
- Authorization checks
"""
import pytest
from fastapi import status
from httpx import AsyncClient

from app.models.schemas import WorkflowStatus


class TestWorkflowRoutes:
    """Test workflow API endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_workflows_empty(self, async_client: AsyncClient):
        """Test getting workflows when none exist."""
        response = await async_client.get("/api/workflows")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    @pytest.mark.asyncio
    async def test_create_workflow_success(self, async_client: AsyncClient, sample_workflow_data):
        """Test successful workflow creation."""
        response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == sample_workflow_data["name"]
        assert data["description"] == sample_workflow_data["description"]
        assert "id" in data
        assert len(data["blocks"]) == 1
    
    @pytest.mark.asyncio
    async def test_create_workflow_invalid_name(self, async_client: AsyncClient):
        """Test workflow creation with invalid name."""
        invalid_data = {
            "name": "",  # Empty name
            "description": "Test",
            "blocks": []
        }
        
        response = await async_client.post(
            "/api/workflows",
            json=invalid_data
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_create_workflow_with_blocks(self, async_client: AsyncClient):
        """Test workflow creation with multiple blocks."""
        workflow_data = {
            "name": "Complex Workflow",
            "description": "Multi-step workflow",
            "blocks": [
                {
                    "name": "Extract",
                    "prompt": "Extract key points from: {{REQUEST_TEXT}}",
                    "order": 1,
                    "block_type": "CUSTOM"
                },
                {
                    "name": "Summarize",
                    "prompt": "Summarize these points: {{Extract}}",
                    "order": 2,
                    "block_type": "CUSTOM",
                    "inputs": [
                        {
                            "input_type": "BLOCK_OUTPUT",
                            "source_block_name": "Extract",
                            "variable_name": "Extract"
                        }
                    ]
                }
            ]
        }
        
        response = await async_client.post(
            "/api/workflows",
            json=workflow_data
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert len(data["blocks"]) == 2
        assert data["blocks"][1]["inputs"][0]["source_block_name"] == "Extract"
    
    @pytest.mark.asyncio
    async def test_get_workflow_by_id(self, async_client: AsyncClient, sample_workflow_data):
        """Test getting a specific workflow."""
        # Create workflow first
        create_response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        workflow_id = create_response.json()["id"]
        
        # Get the workflow
        response = await async_client.get(f"/api/workflows/{workflow_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == workflow_id
        assert data["name"] == sample_workflow_data["name"]
    
    @pytest.mark.asyncio
    async def test_get_workflow_not_found(self, async_client: AsyncClient):
        """Test getting non-existent workflow."""
        response = await async_client.get("/api/workflows/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_update_workflow(self, async_client: AsyncClient, sample_workflow_data):
        """Test updating a workflow."""
        # Create workflow
        create_response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        workflow_id = create_response.json()["id"]
        
        # Update workflow
        update_data = {
            "name": "Updated Workflow",
            "description": "Updated description",
            "status": WorkflowStatus.ACTIVE.value
        }
        
        response = await async_client.put(
            f"/api/workflows/{workflow_id}",
            json=update_data
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["status"] == WorkflowStatus.ACTIVE.value
    
    @pytest.mark.asyncio
    async def test_delete_workflow(self, async_client: AsyncClient, sample_workflow_data):
        """Test deleting a workflow."""
        # Create workflow
        create_response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        workflow_id = create_response.json()["id"]
        
        # Delete workflow
        response = await async_client.delete(f"/api/workflows/{workflow_id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        
        # Verify it's deleted
        get_response = await async_client.get(f"/api/workflows/{workflow_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND


class TestWorkflowEmbeddingConfig:
    """Test workflow embedding configuration endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_embedding_config_not_found(self, async_client: AsyncClient):
        """Test getting embedding config when none exists."""
        response = await async_client.get("/api/workflows/1/embedding-config")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    @pytest.mark.asyncio
    async def test_create_embedding_config(
        self, 
        async_client: AsyncClient, 
        sample_workflow_data,
        sample_embedding_config
    ):
        """Test creating embedding configuration."""
        # Create workflow first
        workflow_response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        workflow_id = workflow_response.json()["id"]
        
        # Create embedding config
        response = await async_client.post(
            f"/api/workflows/{workflow_id}/embedding-config",
            json=sample_embedding_config
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enabled"] == sample_embedding_config["enabled"]
        assert data["embedding_template"] == sample_embedding_config["embedding_template"]
        assert data["workflow_id"] == workflow_id
    
    @pytest.mark.asyncio
    async def test_update_embedding_config(
        self,
        async_client: AsyncClient,
        sample_workflow_data,
        sample_embedding_config
    ):
        """Test updating embedding configuration."""
        # Create workflow
        workflow_response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        workflow_id = workflow_response.json()["id"]
        
        # Create initial config
        await async_client.post(
            f"/api/workflows/{workflow_id}/embedding-config",
            json=sample_embedding_config
        )
        
        # Update config
        updated_config = {
            "enabled": False,
            "embedding_template": "Updated: {{REQUEST_TEXT}}"
        }
        
        response = await async_client.post(
            f"/api/workflows/{workflow_id}/embedding-config",
            json=updated_config
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enabled"] == False
        assert "Updated:" in data["embedding_template"]


class TestWorkflowSimilarityConfig:
    """Test workflow similarity configuration endpoints."""
    
    @pytest.mark.asyncio
    async def test_create_similarity_config(
        self,
        async_client: AsyncClient,
        sample_workflow_data
    ):
        """Test creating similarity configuration."""
        # Create workflow
        workflow_response = await async_client.post(
            "/api/workflows",
            json=sample_workflow_data
        )
        workflow_id = workflow_response.json()["id"]
        
        # Create similarity config
        similarity_config = {
            "fields": [
                {
                    "name": "Summary",
                    "type": "text",
                    "source": "Summarize.summary"
                },
                {
                    "name": "Score",
                    "type": "score",
                    "source": "SIMILARITY_SCORE"
                }
            ]
        }
        
        response = await async_client.post(
            f"/api/workflows/{workflow_id}/similarity-config",
            json=similarity_config
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["fields"]) == 2
        assert data["fields"][0]["name"] == "Summary"