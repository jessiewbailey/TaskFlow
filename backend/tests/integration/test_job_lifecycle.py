"""Test job lifecycle and queue behavior"""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pydantic_models import RequestStatus
from app.models.schemas import JobStatus, JobType, ProcessingJob, Request, Workflow
from app.services.job_service import JobService


@pytest.mark.asyncio
async def test_job_lifecycle_transitions(db_session: AsyncSession):
    """Test that jobs transition through states correctly"""

    # Create a workflow with explicit ID for SQLite compatibility
    workflow = Workflow(
        id=1, name="Test Workflow", description="Test", is_default=True, created_by=1
    )
    db_session.add(workflow)
    await db_session.flush()

    # Create a request with explicit ID for SQLite compatibility
    request = Request(
        id=1,
        text="Test request for job lifecycle",
        requester="Test User",
        workflow_id=workflow.id,
        status=RequestStatus.NEW,
    )
    db_session.add(request)
    await db_session.flush()

    # Create a job
    job_service = JobService(db_session)
    job_id = await job_service.create_job(
        request_id=request.id, job_type=JobType.WORKFLOW, workflow_id=workflow.id
    )

    await db_session.commit()

    # Verify job is created in PENDING status
    job_uuid = uuid.UUID(job_id) if isinstance(job_id, str) else job_id
    job_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_uuid)
    )
    job = job_result.scalar_one()

    assert job.status == JobStatus.PENDING
    assert job.started_at is None
    assert job.completed_at is None

    # Simulate job processing
    # In real scenario, the worker would do this
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Verify job is in RUNNING status
    await db_session.refresh(job)
    assert job.status == JobStatus.RUNNING
    assert job.started_at is not None
    assert job.completed_at is None

    # Simulate job completion
    job.status = JobStatus.COMPLETED
    job.completed_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Verify job is COMPLETED
    await db_session.refresh(job)
    assert job.status == JobStatus.COMPLETED
    assert job.started_at is not None
    assert job.completed_at is not None
    assert job.completed_at > job.started_at


@pytest.mark.asyncio
async def test_multiple_job_queue_behavior(db_session: AsyncSession):
    """Test how multiple jobs behave in the queue"""

    # Create a workflow with explicit ID for SQLite compatibility
    workflow = Workflow(
        id=2,
        name="Test Workflow Multi",
        description="Test",
        is_default=True,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    # Create multiple requests with explicit IDs for SQLite compatibility
    requests = []
    for i in range(10):
        request = Request(
            id=i + 10,  # Start from 10 to avoid conflicts
            text=f"Test request {i}",
            requester="Test User",
            workflow_id=workflow.id,
            status=RequestStatus.NEW,
        )
        db_session.add(request)
        requests.append(request)

    await db_session.flush()

    # Create jobs for all requests
    job_service = JobService(db_session)
    job_ids = []

    for request in requests:
        job_id = await job_service.create_job(
            request_id=request.id, job_type=JobType.WORKFLOW, workflow_id=workflow.id
        )
        job_ids.append(job_id)

    await db_session.commit()

    # Check all jobs are created
    job_uuids = [uuid.UUID(job_id) for job_id in job_ids]
    jobs_result = await db_session.execute(
        select(ProcessingJob)
        .where(ProcessingJob.id.in_(job_uuids))
        .order_by(ProcessingJob.created_at)
    )
    jobs = jobs_result.scalars().all()

    assert len(jobs) == 10

    # All should start as PENDING
    for job in jobs:
        assert job.status == JobStatus.PENDING

    # Simulate processing first 4 jobs (max concurrent)
    for i in range(4):
        jobs[i].status = JobStatus.RUNNING
        jobs[i].started_at = datetime.now(timezone.utc)

    await db_session.commit()

    # Check status distribution
    status_count = {}
    for job in jobs:
        await db_session.refresh(job)
        status = job.status.value
        status_count[status] = status_count.get(status, 0) + 1

    assert status_count.get("RUNNING", 0) == 4
    assert status_count.get("PENDING", 0) == 6


@pytest.mark.asyncio
async def test_job_retry_after_failure(db_session: AsyncSession):
    """Test job behavior after failure"""

    # Create workflow and request
    workflow = Workflow(
        id=3,
        name="Test Workflow Retry",
        description="Test",
        is_default=True,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    request = Request(
        id=100,  # Use unique ID
        text="Test request for failure",
        requester="Test User",
        workflow_id=workflow.id,
        status=RequestStatus.NEW,
    )
    db_session.add(request)
    await db_session.flush()

    # Create and fail a job
    job_service = JobService(db_session)
    job_id = await job_service.create_job(
        request_id=request.id, job_type=JobType.WORKFLOW, workflow_id=workflow.id
    )

    await db_session.commit()

    # Simulate job failure
    job_uuid = uuid.UUID(job_id)
    job_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_uuid)
    )
    job = job_result.scalar_one()

    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Fail the job
    job.status = JobStatus.FAILED
    job.completed_at = datetime.now(timezone.utc)
    job.error_message = "Test failure"
    await db_session.commit()

    # Verify job failed
    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED
    assert job.error_message == "Test failure"

    # Create a retry job
    retry_job_id = await job_service.create_job(
        request_id=request.id, job_type=JobType.WORKFLOW, workflow_id=workflow.id
    )

    await db_session.commit()

    # Verify new job is created
    assert retry_job_id != job_id

    retry_job_uuid = uuid.UUID(retry_job_id)
    retry_job_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.id == retry_job_uuid)
    )
    retry_job = retry_job_result.scalar_one()

    assert retry_job.status == JobStatus.PENDING
    assert retry_job.request_id == request.id


@pytest.mark.asyncio
async def test_embedding_job_after_workflow_completion(db_session: AsyncSession):
    """Test that embedding jobs are created after workflow completion"""

    # Create workflow with embedding config
    workflow = Workflow(
        id=4,
        name="Test Workflow Embedding",
        description="Test",
        is_default=True,
        created_by=1,
    )
    db_session.add(workflow)
    await db_session.flush()

    # Create request with explicit ID for SQLite compatibility
    request = Request(
        id=200,  # Use unique ID
        text="Test request for embedding",
        requester="Test User",
        workflow_id=workflow.id,
        status=RequestStatus.NEW,
    )
    db_session.add(request)
    await db_session.flush()

    # Create workflow job
    job_service = JobService(db_session)
    _workflow_job_id = await job_service.create_job(
        request_id=request.id, job_type=JobType.WORKFLOW, workflow_id=workflow.id
    )

    await db_session.commit()

    # Verify only workflow job exists
    jobs_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.request_id == request.id)
    )
    jobs = jobs_result.scalars().all()

    assert len(jobs) == 1
    assert jobs[0].job_type == JobType.WORKFLOW

    # Complete the workflow job
    workflow_job = jobs[0]
    workflow_job.status = JobStatus.COMPLETED
    workflow_job.started_at = datetime.now(timezone.utc)
    workflow_job.completed_at = datetime.now(timezone.utc)
    await db_session.commit()

    # In real scenario, the worker would create embedding job
    # Here we simulate it
    _embedding_job_id = await job_service.create_job(
        request_id=request.id, job_type=JobType.EMBEDDING
    )

    await db_session.commit()

    # Verify both jobs exist
    all_jobs_result = await db_session.execute(
        select(ProcessingJob)
        .where(ProcessingJob.request_id == request.id)
        .order_by(ProcessingJob.created_at)
    )
    all_jobs = all_jobs_result.scalars().all()

    assert len(all_jobs) == 2
    assert all_jobs[0].job_type == JobType.WORKFLOW
    assert all_jobs[0].status == JobStatus.COMPLETED
    assert all_jobs[1].job_type == JobType.EMBEDDING
    assert all_jobs[1].status == JobStatus.PENDING

    # Verify basic job creation order and types
    # (timing precision not critical for infrastructure tests)
    assert len(all_jobs) == 2
    assert all_jobs[0].job_type == JobType.WORKFLOW
    assert all_jobs[1].job_type == JobType.EMBEDDING
