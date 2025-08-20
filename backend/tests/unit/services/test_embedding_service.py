"""
Unit tests for EmbeddingService

Tests cover:
- Embedding generation
- Vector storage and retrieval
- Similarity search
- Error handling
- Retry logic
"""

import asyncio
from unittest.mock import Mock, patch

import pytest

from app.services.embedding_service import EmbeddingService


class TestEmbeddingService:
    """Test the EmbeddingService class."""

    @pytest.fixture
    def mock_ollama_response(self):
        """Mock response from Ollama API."""
        return {"embedding": [0.1] * 768}

    @pytest.fixture
    def mock_qdrant_client(self):
        """Create mock Qdrant client."""
        client = Mock()
        client.upsert = Mock(return_value=True)
        client.search = Mock(return_value=[])
        client.delete = Mock(return_value=True)
        client.scroll = Mock(return_value=([], None))
        client.retrieve = Mock(return_value=[])

        # Mock collection management
        mock_collection = Mock()
        mock_collection.name = "tasks"
        client.get_collections = Mock(return_value=Mock(collections=[mock_collection]))
        client.create_collection = Mock(return_value=True)

        return client

    @pytest.fixture
    def mock_ollama_client(self):
        """Create mock Ollama client."""
        return Mock()

    @pytest.fixture
    def embedding_service(self, mock_qdrant_client, mock_ollama_client):
        """Create EmbeddingService with mocked dependencies."""
        with patch(
            "app.services.embedding_service.QdrantClient",
            return_value=mock_qdrant_client,
        ):
            with patch(
                "app.services.embedding_service.OllamaClient",
                return_value=mock_ollama_client,
            ):
                with patch("app.services.embedding_service.requests.Session"):
                    service = EmbeddingService()
                    service.qdrant_client = mock_qdrant_client
                    service.ollama_client = mock_ollama_client
                    return service

    @pytest.mark.asyncio
    async def test_generate_embedding_success(
        self, embedding_service, mock_ollama_response
    ):
        """Test successful embedding generation."""
        # Setup mock response
        mock_response = Mock()
        mock_response.json.return_value = mock_ollama_response
        mock_response.raise_for_status = Mock()

        with patch.object(
            embedding_service.session, "post", return_value=mock_response
        ):
            # Act
            embedding = await embedding_service.generate_embedding("Test text")

            # Assert
            assert len(embedding) == 768
            assert all(val == 0.1 for val in embedding)

    @pytest.mark.asyncio
    async def test_generate_embedding_retry_on_failure(self, embedding_service):
        """Test retry logic when embedding generation fails."""
        # Setup mock to fail twice then succeed
        mock_response_fail = Mock()
        mock_response_fail.raise_for_status.side_effect = Exception("API Error")

        mock_response_success = Mock()
        mock_response_success.json.return_value = {"embedding": [0.2] * 768}
        mock_response_success.raise_for_status = Mock()

        with patch.object(
            embedding_service.session,
            "post",
            side_effect=[mock_response_fail, mock_response_fail, mock_response_success],
        ):
            # Act
            embedding = await embedding_service.generate_embedding(
                "Test text", max_retries=3
            )

            # Assert - should succeed on third attempt
            assert len(embedding) == 768
            assert all(val == 0.2 for val in embedding)

    @pytest.mark.asyncio
    async def test_generate_embedding_fallback_on_total_failure(
        self, embedding_service
    ):
        """Test fallback to zero vector when all retries fail."""
        # Setup mock to always fail
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = Exception("Persistent API Error")

        with patch.object(
            embedding_service.session, "post", return_value=mock_response
        ):
            # Act
            embedding = await embedding_service.generate_embedding(
                "Test text", max_retries=2
            )

            # Assert - should return zero vector
            assert len(embedding) == 768
            assert all(val == 0.0 for val in embedding)

    @pytest.mark.asyncio
    async def test_store_task_embedding(self, embedding_service, mock_qdrant_client):
        """Test storing task embedding in Qdrant."""
        # Arrange
        task_id = 123
        task_data = {
            "title": "Test Task",
            "description": "Test Description",
            "priority": "high",
            "status": "NEW",
            "tags": ["test", "urgent"],
            "exercise_id": 1,
            "created_at": "2024-01-01T00:00:00Z",
        }

        # Mock embedding generation
        with patch.object(
            embedding_service, "generate_embedding", return_value=[0.1] * 768
        ) as mock_generate:
            # Act
            with patch("uuid.uuid4", return_value="test-uuid"):
                point_id = await embedding_service.store_task_embedding(
                    task_id, task_data
                )

            # Assert
            assert point_id == "test-uuid"
            mock_generate.assert_called_once()

            # Verify the text used for embedding contains all fields
            call_args = mock_generate.call_args[0][0]
            assert "Test Task" in call_args
            assert "Test Description" in call_args
            assert "high" in call_args
            assert "test, urgent" in call_args

            # Verify Qdrant upsert was called
            mock_qdrant_client.upsert.assert_called_once()
            upsert_args = mock_qdrant_client.upsert.call_args
            assert upsert_args[1]["collection_name"] == "tasks"
            assert len(upsert_args[1]["points"]) == 1

            point = upsert_args[1]["points"][0]
            assert point.id == "test-uuid"
            assert point.payload["task_id"] == task_id
            assert point.payload["title"] == "Test Task"

    @pytest.mark.asyncio
    async def test_search_similar_tasks(self, embedding_service, mock_qdrant_client):
        """Test searching for similar tasks."""
        # Arrange
        query_text = "Find similar tasks"

        # Mock search results
        mock_hit1 = Mock()
        mock_hit1.score = 0.95
        mock_hit1.payload = {
            "task_id": 1,
            "title": "Similar Task 1",
            "description": "Description 1",
            "priority": "high",
            "status": "NEW",
            "tags": ["tag1"],
            "exercise_id": 1,
            "created_at": "2024-01-01T00:00:00Z",
        }

        mock_hit2 = Mock()
        mock_hit2.score = 0.85
        mock_hit2.payload = {
            "task_id": 2,
            "title": "Similar Task 2",
            "description": "Description 2",
            "priority": "medium",
            "status": "IN_PROGRESS",
            "tags": ["tag2"],
            "exercise_id": 1,
            "created_at": "2024-01-02T00:00:00Z",
        }

        mock_qdrant_client.search.return_value = [mock_hit1, mock_hit2]

        # Mock embedding generation
        with patch.object(
            embedding_service, "generate_embedding", return_value=[0.1] * 768
        ):
            # Act
            results = await embedding_service.search_similar_tasks(
                query_text, limit=5, filters={"exercise_id": 1}
            )

            # Assert
            assert len(results) == 2
            assert results[0]["score"] == 0.95
            assert results[0]["task_id"] == 1
            assert results[0]["title"] == "Similar Task 1"
            assert results[1]["score"] == 0.85
            assert results[1]["task_id"] == 2

            # Verify search was called with correct parameters
            mock_qdrant_client.search.assert_called_once()
            search_args = mock_qdrant_client.search.call_args
            assert search_args[1]["collection_name"] == "tasks"
            assert search_args[1]["limit"] == 5
            assert search_args[1]["query_filter"] is not None

    @pytest.mark.asyncio
    async def test_search_similar_by_task_id(
        self, embedding_service, mock_qdrant_client
    ):
        """Test searching similar tasks by task ID."""
        # Arrange
        task_id = 123

        # Mock scroll result to find the task
        mock_task_point = Mock()
        mock_task_point.id = "task-point-id"
        mock_qdrant_client.scroll.return_value = ([mock_task_point], None)

        # Mock retrieve to get vector
        mock_retrieved_point = Mock()
        mock_retrieved_point.vector = [0.2] * 768
        mock_qdrant_client.retrieve.return_value = [mock_retrieved_point]

        # Mock search results
        mock_hit = Mock()
        mock_hit.score = 0.90
        mock_hit.payload = {
            "task_id": 456,  # Different task
            "title": "Similar Task",
            "description": "Similar Description",
            "priority": "high",
            "status": "NEW",
            "tags": [],
            "exercise_id": 1,
            "created_at": "2024-01-01T00:00:00Z",
        }

        mock_qdrant_client.search.return_value = [mock_hit]

        # Act
        results = await embedding_service.search_similar_by_task_id(
            task_id, limit=5, exclude_self=True
        )

        # Assert
        assert len(results) == 1
        assert results[0]["task_id"] == 456
        assert results[0]["score"] == 0.90

        # Verify the sequence of calls
        mock_qdrant_client.scroll.assert_called_once()
        mock_qdrant_client.retrieve.assert_called_once()
        mock_qdrant_client.search.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_task_embedding(self, embedding_service, mock_qdrant_client):
        """Test deleting task embedding."""
        # Arrange
        task_id = 123

        # Act
        await embedding_service.delete_task_embedding(task_id)

        # Assert
        mock_qdrant_client.delete.assert_called_once()
        delete_args = mock_qdrant_client.delete.call_args
        assert delete_args[1]["collection_name"] == "tasks"

        # Verify filter condition
        filter_arg = delete_args[1]["points_selector"]
        assert filter_arg.must[0].key == "task_id"
        assert filter_arg.must[0].match.value == task_id

    def test_ensure_collection_creates_if_missing(self, mock_qdrant_client):
        """Test collection creation when it doesn't exist."""
        # Arrange - no collections exist
        mock_qdrant_client.get_collections.return_value = Mock(collections=[])

        # Act
        with patch(
            "app.services.embedding_service.QdrantClient",
            return_value=mock_qdrant_client,
        ):
            with patch("app.services.embedding_service.OllamaClient"):
                with patch("app.services.embedding_service.requests.Session"):
                    _service = EmbeddingService()

        # Assert
        mock_qdrant_client.create_collection.assert_called_once()
        create_args = mock_qdrant_client.create_collection.call_args
        assert create_args[1]["collection_name"] == "tasks"
        assert create_args[1]["vectors_config"].size == 768

    @pytest.mark.asyncio
    async def test_concurrent_embedding_generation(self, embedding_service):
        """Test that concurrent requests are limited by semaphore."""
        # This test verifies that the semaphore limits concurrent requests
        # In practice, this is more of an integration test

        call_count = 0
        max_concurrent = 0
        current_concurrent = 0

        async def mock_post(*args, **kwargs):
            nonlocal call_count, max_concurrent, current_concurrent
            current_concurrent += 1
            max_concurrent = max(max_concurrent, current_concurrent)
            call_count += 1

            # Simulate some processing time
            await asyncio.sleep(0.1)

            current_concurrent -= 1

            mock_response = Mock()
            mock_response.json.return_value = {"embedding": [0.1] * 768}
            mock_response.raise_for_status = Mock()
            return mock_response

        with patch.object(embedding_service.session, "post", side_effect=mock_post):
            # Create multiple concurrent requests
            tasks = [
                embedding_service.generate_embedding(f"Text {i}") for i in range(5)
            ]

            # Wait for all to complete
            results = await asyncio.gather(*tasks)

            # Assert
            assert len(results) == 5
            assert call_count == 5
            # With semaphore limit of 2, max concurrent should not exceed 2
            assert max_concurrent <= 2


class TestEmbeddingServiceIntegration:
    """Integration tests for EmbeddingService with real-ish behavior."""

    @pytest.mark.asyncio
    async def test_end_to_end_task_workflow(
        self, embedding_service, mock_qdrant_client
    ):
        """Test complete workflow: create embedding, search, and delete."""
        # Mock embedding generation to return consistent vectors
        with patch.object(
            embedding_service,
            "generate_embedding",
            side_effect=lambda text: [hash(text) % 100 / 100.0] * 768,
        ):
            # Store a task
            task_id = 1
            task_data = {
                "title": "Original Task",
                "description": "This is the original task",
                "priority": "high",
                "status": "NEW",
            }

            point_id = await embedding_service.store_task_embedding(task_id, task_data)
            assert point_id is not None

            # Search for similar tasks
            mock_qdrant_client.search.return_value = [
                Mock(score=0.95, payload={"task_id": task_id, "title": "Original Task"})
            ]

            results = await embedding_service.search_similar_tasks(
                "Find tasks about original work"
            )

            assert len(results) > 0
            assert results[0]["task_id"] == task_id

            # Delete the task
            await embedding_service.delete_task_embedding(task_id)

            # Verify all operations were called
            assert mock_qdrant_client.upsert.called
            assert mock_qdrant_client.search.called
            assert mock_qdrant_client.delete.called
