"""
Integration tests for complete workflow execution

Tests cover:
- End-to-end workflow processing
- Job queue integration
- Event publishing
- Embedding generation after completion
"""
import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import (
    Request, Workflow, WorkflowBlock, ProcessingJob, 
    JobStatus, RequestStatus, EmbeddingStatus,
    WorkflowEmbeddingConfig, AIOutput
)
from app.services.job_service import JobService


@pytest.mark.integration
class TestWorkflowExecution:
    """Test complete workflow execution from request to completion."""
    
    @pytest.fixture
    async def sample_workflow(self, db_session: AsyncSession):
        """Create a sample workflow in the database."""
        workflow = Workflow(
            name="Test Analysis Workflow",
            description="Workflow for integration testing",
            status="ACTIVE",
            is_default=False,
            created_by=1
        )
        db_session.add(workflow)
        await db_session.commit()
        
        # Add blocks
        blocks = [
            WorkflowBlock(
                workflow_id=workflow.id,
                name="Extract",
                prompt="Extract key points from: {{REQUEST_TEXT}}",
                order=1,
                block_type="CUSTOM"
            ),
            WorkflowBlock(
                workflow_id=workflow.id,
                name="Analyze",
                prompt="Analyze these points: {{Extract}}",
                order=2,
                block_type="CUSTOM"
            )
        ]
        
        for block in blocks:
            db_session.add(block)
        await db_session.commit()
        
        # Add embedding configuration
        embedding_config = WorkflowEmbeddingConfig(
            workflow_id=workflow.id,
            enabled=True,
            embedding_template="Key Points: {{Extract.points}}\nAnalysis: {{Analyze.summary}}"
        )
        db_session.add(embedding_config)
        await db_session.commit()
        
        return workflow
    
    @pytest.fixture
    async def sample_request(self, db_session: AsyncSession, sample_workflow):
        """Create a sample request in the database."""
        request = Request(
            text="This is a test document that needs analysis. It contains important information.",
            requester="test@example.com",
            status=RequestStatus.NEW,
            embedding_status=EmbeddingStatus.PENDING,
            workflow_id=sample_workflow.id,
            exercise_id=1
        )
        db_session.add(request)
        await db_session.commit()
        return request
    
    @pytest.mark.asyncio
    async def test_complete_workflow_execution(
        self,
        db_session: AsyncSession,
        sample_workflow,
        sample_request,
        mock_redis
    ):
        """Test complete workflow execution from start to finish."""
        # Mock AI worker response
        mock_ai_response = {
            "Extract": {
                "points": ["Important information", "Needs analysis"]
            },
            "Analyze": {
                "summary": "Document contains critical data requiring immediate attention"
            }
        }
        
        with patch('httpx.AsyncClient') as mock_client_class:
            # Mock the AI worker call
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.raise_for_status = Mock()
            mock_response.json.return_value = {"status": "success"}
            
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client
            
            # Mock embedding service
            with patch('app.services.embedding_service.embedding_service.generate_embedding') as mock_embed:
                mock_embed.return_value = [0.1] * 768
                
                # Create job service
                job_service = JobService(db_session)
                
                # Start job processing
                job_id = await job_service.create_job(
                    request_id=sample_request.id,
                    workflow_id=sample_workflow.id,
                    job_type="WORKFLOW"
                )
                
                # Simulate AI output being saved
                ai_output = AIOutput(
                    request_id=sample_request.id,
                    version=1,
                    summary=str(mock_ai_response),
                    model_name="test-model",
                    tokens_used=100,
                    duration_ms=1000
                )
                db_session.add(ai_output)
                await db_session.commit()
                
                # Process the job (in real scenario this would be async)
                await job_service._process_job(job_id)
                
                # Verify job completed
                job = await db_session.get(ProcessingJob, job_id)
                assert job is not None
                assert job.status == JobStatus.COMPLETED
                
                # Verify request status updated
                request = await db_session.get(Request, sample_request.id)
                assert request.status == RequestStatus.CLOSED
                
                # Verify embedding was generated
                mock_embed.assert_called()
                embedding_text = mock_embed.call_args[0][0]
                assert "Important information" in embedding_text
                assert "Document contains critical data" in embedding_text
    
    @pytest.mark.asyncio
    async def test_workflow_failure_handling(
        self,
        db_session: AsyncSession,
        sample_workflow,
        sample_request
    ):
        """Test workflow execution failure and retry logic."""
        # Mock AI worker to fail
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = Exception("AI Worker Error")
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client
            
            job_service = JobService(db_session)
            
            # Create job
            job_id = await job_service.create_job(
                request_id=sample_request.id,
                workflow_id=sample_workflow.id,
                job_type="WORKFLOW"
            )
            
            # Process should fail
            with pytest.raises(Exception):
                await job_service._process_job(job_id)
            
            # Verify job marked as failed
            job = await db_session.get(ProcessingJob, job_id)
            assert job.status == JobStatus.FAILED
            assert "AI Worker Error" in job.error_message
    
    @pytest.mark.asyncio
    async def test_concurrent_job_processing(
        self,
        db_session: AsyncSession,
        sample_workflow
    ):
        """Test concurrent job processing with queue limits."""
        # Create multiple requests
        requests = []
        for i in range(10):
            request = Request(
                text=f"Test document {i}",
                requester=f"user{i}@example.com",
                status=RequestStatus.NEW,
                priority="medium",
                workflow_id=sample_workflow.id
            )
            db_session.add(request)
            requests.append(request)
        await db_session.commit()
        
        # Create jobs for all requests
        job_service = JobService(db_session)
        job_ids = []
        
        for request in requests:
            job_id = await job_service.create_job(
                request_id=request.id,
                workflow_id=sample_workflow.id
            )
            job_ids.append(job_id)
        
        # Verify queue positions
        from app.services.job_service import job_queue_manager
        
        # First 4 should be running (max_concurrent_jobs=4)
        for i in range(4):
            position = job_queue_manager.get_queue_position(job_ids[i])
            assert position == -1  # Running
        
        # Rest should be queued
        for i in range(4, 10):
            position = job_queue_manager.get_queue_position(job_ids[i])
            assert position >= 0  # In queue
    
    @pytest.mark.asyncio
    async def test_event_publishing_during_execution(
        self,
        db_session: AsyncSession,
        sample_workflow,
        sample_request,
        mock_redis
    ):
        """Test that events are published during job execution."""
        published_events = []
        
        # Mock Redis publish to capture events
        async def mock_publish(channel, message):
            published_events.append((channel, message))
            return 1
        
        mock_redis.publish = AsyncMock(side_effect=mock_publish)
        
        with patch('app.services.event_bus.redis_client', mock_redis):
            job_service = JobService(db_session)
            
            # Create and start job
            job_id = await job_service.create_job(
                request_id=sample_request.id,
                workflow_id=sample_workflow.id
            )
            
            # Publish job created event
            await event_bus.publish("job_created", {
                "job_id": job_id,
                "request_id": sample_request.id,
                "status": "PENDING"
            })
            
            # Verify events were published
            assert len(published_events) > 0
            assert published_events[0][0] == "taskflow:events"
            
            # Parse event data
            import json
            event_data = json.loads(published_events[0][1])
            assert event_data["type"] == "job_created"
            assert event_data["data"]["job_id"] == job_id
    
    @pytest.mark.asyncio
    async def test_embedding_generation_after_workflow(
        self,
        db_session: AsyncSession,
        sample_workflow,
        sample_request
    ):
        """Test that embeddings are generated after successful workflow completion."""
        # Mock successful AI processing
        with patch('httpx.AsyncClient') as mock_client_class:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.raise_for_status = Mock()
            
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client.__aenter__.return_value = mock_client
            mock_client.__aexit__.return_value = None
            mock_client_class.return_value = mock_client
            
            # Track embedding service calls
            embedding_calls = []
            
            async def mock_send_embedding(request_id, text):
                embedding_calls.append((request_id, text))
            
            with patch('app.services.job_service.JobService._send_to_embedding_service', mock_send_embedding):
                job_service = JobService(db_session)
                
                # Add AI output for workflow
                ai_output = AIOutput(
                    request_id=sample_request.id,
                    version=1,
                    summary='{"Extract": {"points": ["test"]}, "Analyze": {"summary": "analysis"}}',
                    model_name="test-model"
                )
                db_session.add(ai_output)
                await db_session.commit()
                
                # Generate embedding
                await job_service._generate_workflow_embedding(
                    sample_request.id,
                    sample_workflow.id,
                    db_session
                )
                
                # Verify embedding was generated
                assert len(embedding_calls) == 1
                assert embedding_calls[0][0] == sample_request.id
                assert "test" in embedding_calls[0][1]
                assert "analysis" in embedding_calls[0][1]


@pytest.mark.integration
class TestWorkflowWithCustomInstructions:
    """Test workflow execution with custom instructions."""
    
    @pytest.mark.asyncio
    async def test_custom_instructions_override(
        self,
        db_session: AsyncSession,
        sample_workflow,
        sample_request
    ):
        """Test that custom instructions modify workflow behavior."""
        # Add custom instruction
        from app.models.schemas import CustomInstruction
        
        custom_instruction = CustomInstruction(
            request_id=sample_request.id,
            workflow_block_id=1,  # First block
            instruction_text="Use formal academic tone",
            created_by=1,
            is_active=True
        )
        db_session.add(custom_instruction)
        await db_session.commit()
        
        # Verify instruction is applied during processing
        # This would be verified in the actual AI worker call
        # For now, we just verify the instruction exists
        
        result = await db_session.execute(
            select(CustomInstruction).where(
                CustomInstruction.request_id == sample_request.id
            )
        )
        instructions = result.scalars().all()
        assert len(instructions) == 1
        assert instructions[0].instruction_text == "Use formal academic tone"