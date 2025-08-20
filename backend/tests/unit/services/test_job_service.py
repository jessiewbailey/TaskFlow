"""
Unit tests for JobService

Tests cover:
- Job creation and queuing
- Job status updates
- Queue position calculation
- Retry logic
- Error handling
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from app.models.pydantic_models import JobProgressResponse
from app.models.schemas import JobStatus, JobType, ProcessingJob, Request, WorkflowEmbeddingConfig
from app.services.job_service import JobQueueManager, JobService


class TestJobQueueManager:
    """Test the JobQueueManager class."""

    def test_init(self):
        """Test queue manager initialization."""
        manager = JobQueueManager(max_concurrent_jobs=5)
        assert manager.max_concurrent_jobs == 5
        assert len(manager.running_jobs) == 0
        assert manager.job_queue.qsize() == 0

    def test_get_queue_position_not_found(self):
        """Test queue position when job is not in queue."""
        manager = JobQueueManager()
        position = manager.get_queue_position("nonexistent-job")
        assert position == -1

    def test_get_queue_position_running(self):
        """Test queue position when job is running."""
        manager = JobQueueManager()
        manager.running_jobs.add("running-job")
        position = manager.get_queue_position("running-job")
        assert position == -1

    @pytest.mark.asyncio
    async def test_add_job(self):
        """Test adding job to queue."""
        manager = JobQueueManager()
        job_id = "test-job-1"
        job_coro = AsyncMock()

        await manager.add_job(job_id, job_coro)
        assert manager.job_queue.qsize() == 1

        # Get the job from queue
        queued_job_id, queued_coro = await manager.job_queue.get()
        assert queued_job_id == job_id
        assert queued_coro == job_coro


class TestJobService:
    """Test the JobService class."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = AsyncMock()
        db.add = Mock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()
        db.scalar_one_or_none = Mock()
        return db

    @pytest.fixture
    def job_service(self, mock_db):
        """Create JobService instance."""
        return JobService(mock_db)

    @pytest.mark.asyncio
    async def test_create_job_standard(self, job_service, mock_db):
        """Test creating a standard job."""
        # Arrange
        request_id = 123
        job_type = JobType.STANDARD

        with patch("uuid.uuid4", return_value=uuid.UUID("12345678-1234-5678-1234-567812345678")):
            with patch(
                "app.services.job_service.job_queue_manager.add_job",
                new_callable=AsyncMock,
            ) as mock_add:
                # Act
                job_id = await job_service.create_job(request_id=request_id, job_type=job_type)

        # Assert
        assert job_id == "12345678-1234-5678-1234-567812345678"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_add.assert_called_once()

        # Check the job object that was added
        added_job = mock_db.add.call_args[0][0]
        assert isinstance(added_job, ProcessingJob)
        assert added_job.request_id == request_id
        assert added_job.job_type == job_type
        assert added_job.status == JobStatus.PENDING

    @pytest.mark.asyncio
    async def test_create_job_with_custom_instructions(self, job_service, mock_db):
        """Test creating a job with custom instructions."""
        # Arrange
        request_id = 456
        job_type = JobType.CUSTOM
        custom_instructions = "Use a formal tone"
        workflow_id = 789

        with patch("uuid.uuid4", return_value=uuid.UUID("87654321-4321-8765-4321-876543218765")):
            with patch(
                "app.services.job_service.job_queue_manager.add_job",
                new_callable=AsyncMock,
            ):
                # Act
                await job_service.create_job(
                    request_id=request_id,
                    job_type=job_type,
                    custom_instructions=custom_instructions,
                    workflow_id=workflow_id,
                )

        # Assert
        added_job = mock_db.add.call_args[0][0]
        assert added_job.custom_instructions == custom_instructions
        assert added_job.workflow_id == workflow_id

    @pytest.mark.asyncio
    async def test_get_job_status_found(self, job_service, mock_db):
        """Test getting status of existing job."""
        # Arrange
        job_id = "test-job-id"
        mock_job = Mock(spec=ProcessingJob)
        mock_job.id = job_id
        mock_job.request_id = 123
        mock_job.status = JobStatus.RUNNING
        mock_job.error_message = None
        mock_job.started_at = datetime.utcnow()
        mock_job.completed_at = None
        mock_job.created_at = datetime.utcnow()

        result = Mock()
        result.scalar_one_or_none.return_value = mock_job
        mock_db.execute.return_value = result

        # Act
        status = await job_service.get_job_status(job_id)

        # Assert
        assert isinstance(status, JobProgressResponse)
        assert status.job_id == job_id
        assert status.request_id == 123
        assert status.status == JobStatus.RUNNING

    @pytest.mark.asyncio
    async def test_get_job_status_not_found(self, job_service, mock_db):
        """Test getting status of non-existent job."""
        # Arrange
        result = Mock()
        result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = result

        # Act
        status = await job_service.get_job_status("nonexistent")

        # Assert
        assert status is None

    def test_get_max_retries(self, job_service):
        """Test retry count calculation for different job types."""
        assert job_service._get_max_retries(JobType.EMBEDDING) == 3
        assert job_service._get_max_retries(JobType.WORKFLOW) == 2
        assert job_service._get_max_retries(JobType.BULK_EMBEDDING) == 1
        assert job_service._get_max_retries(JobType.STANDARD) == 2

    @pytest.mark.asyncio
    async def test_generate_workflow_embedding_disabled(self, job_service, mock_db):
        """Test embedding generation when disabled."""
        # Arrange
        request_id = "123"
        workflow_id = 1

        # Mock embedding config query
        config_result = Mock()
        config_result.scalar_one_or_none.return_value = Mock(enabled=False)
        mock_db.execute.return_value = config_result

        # Act
        await job_service._generate_workflow_embedding(request_id, workflow_id, mock_db)

        # Assert - should return early, only one execute call for config
        assert mock_db.execute.call_count == 1

    @pytest.mark.asyncio
    async def test_generate_workflow_embedding_success(self, job_service, mock_db):
        """Test successful embedding generation."""
        # Arrange
        request_id = "123"
        workflow_id = 1

        # Mock embedding config
        embedding_config = Mock(spec=WorkflowEmbeddingConfig)
        embedding_config.enabled = True
        embedding_config.embedding_template = "Summary: {{Summarize.summary}}"

        # Mock request
        request = Mock(spec=Request)
        request.text = "Test request text"

        # Mock AI output
        ai_output = Mock()
        ai_output.summary = '{"Summarize": {"summary": "Test summary"}}'

        # Setup mock returns
        config_result = Mock()
        config_result.scalar_one_or_none.return_value = embedding_config

        request_result = Mock()
        request_result.scalar_one_or_none.return_value = request

        output_result = Mock()
        output_result.scalars.return_value.first.return_value = ai_output

        mock_db.execute.side_effect = [config_result, request_result, output_result]

        with patch.object(
            job_service, "_send_to_embedding_service", new_callable=AsyncMock
        ) as mock_send:
            # Act
            await job_service._generate_workflow_embedding(request_id, workflow_id, mock_db)

            # Assert
            mock_send.assert_called_once()
            call_args = mock_send.call_args[0]
            assert call_args[0] == request_id
            assert "Test summary" in call_args[1]


@pytest.mark.asyncio
class TestJobProcessing:
    """Test job processing functionality."""

    @pytest.fixture
    def mock_httpx_client(self):
        """Mock httpx client for AI worker calls."""
        client = AsyncMock()
        response = Mock()
        response.status_code = 200
        response.raise_for_status = Mock()
        client.post.return_value = response
        return client

    @pytest.mark.asyncio
    async def test_process_job_success(self, mock_httpx_client):
        """Test successful job processing."""
        # This would require more complex setup with database mocking
        # Placeholder for integration test
        pass

    @pytest.mark.asyncio
    async def test_process_job_retry_on_failure(self):
        """Test job retry logic on failure."""
        # This would require more complex setup
        # Placeholder for integration test
        pass
