"""Test job state transitions and frontend polling behavior"""

import asyncio
import time
from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pydantic_models import RequestStatus
from app.models.schemas import JobStatus, JobType, ProcessingJob, Request, Workflow
from app.services.job_service import JobService


@pytest.mark.asyncio
async def test_rapid_job_state_transitions(db_session: AsyncSession):
    """Test how quickly jobs transition through states"""

    # Create a workflow
    workflow = Workflow(
        name="Test Workflow", description="Test", is_default=True, created_by=1
    )
    db_session.add(workflow)
    await db_session.flush()

    # Create a request
    request = Request(
        text="Test request for rapid transitions",
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

    # Simulate rapid state transitions
    transition_times = []

    # Time when job is created (PENDING)
    start_time = time.time()
    transition_times.append(("PENDING", 0))

    # Simulate job being picked up quickly (RUNNING)
    await asyncio.sleep(0.1)  # 100ms delay
    job_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id)
    )
    job = job_result.scalar_one()
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    await db_session.commit()
    transition_times.append(("RUNNING", time.time() - start_time))

    # Simulate quick completion (COMPLETED)
    await asyncio.sleep(0.5)  # 500ms processing
    job.status = JobStatus.COMPLETED
    job.completed_at = datetime.now(timezone.utc)
    await db_session.commit()
    transition_times.append(("COMPLETED", time.time() - start_time))

    # Print transition times for analysis
    print("\nJob State Transitions:")
    for state, elapsed in transition_times:
        print(f"  {state}: {elapsed:.3f}s")

    # Verify total time is under 1 second
    total_time = transition_times[-1][1]
    assert total_time < 1.0, f"Job completed too slowly: {total_time:.3f}s"

    # Verify job is completed
    await db_session.refresh(job)
    assert job.status == JobStatus.COMPLETED


@pytest.mark.asyncio
async def test_polling_window_race_condition(db_session: AsyncSession):
    """Test potential race conditions with frontend polling"""

    # Create workflow and request
    workflow = Workflow(
        name="Test Workflow", description="Test", is_default=True, created_by=1
    )
    db_session.add(workflow)
    await db_session.flush()

    request = Request(
        text="Test request for polling",
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

    # Simulate frontend polling at 1-second intervals
    polling_results = []

    async def check_active_jobs():
        """Simulate the backend check for active jobs"""
        result = await db_session.execute(
            select(ProcessingJob)
            .where(ProcessingJob.request_id == request.id)
            .where(ProcessingJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING]))
        )
        active_job = result.scalar_one_or_none()
        return active_job is not None

    # Start polling
    time.time()  # Record start time

    # Poll 1: Should see active job (PENDING)
    has_active = await check_active_jobs()
    polling_results.append((0, has_active, "PENDING"))
    assert has_active is True

    # Start processing after 200ms
    await asyncio.sleep(0.2)
    job_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.id == job_id)
    )
    job = job_result.scalar_one()
    job.status = JobStatus.RUNNING
    job.started_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Poll 2: After 1 second - should still see active job (RUNNING)
    await asyncio.sleep(0.8)  # Total: 1 second
    has_active = await check_active_jobs()
    polling_results.append((1.0, has_active, "RUNNING"))
    assert has_active is True

    # Complete job after 1.3 seconds total
    await asyncio.sleep(0.3)
    job.status = JobStatus.COMPLETED
    job.completed_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Poll 3: After 2 seconds - should NOT see active job (COMPLETED)
    await asyncio.sleep(0.7)  # Total: 2 seconds
    has_active = await check_active_jobs()
    polling_results.append((2.0, has_active, "COMPLETED"))
    assert has_active is False

    # Print polling results
    print("\nPolling Results:")
    for poll_time, active, state in polling_results:
        print(f"  {poll_time:.1f}s: has_active_jobs={active} (job state: {state})")


@pytest.mark.asyncio
async def test_concurrent_job_completion_visibility(db_session: AsyncSession):
    """Test visibility of job completion with concurrent requests"""

    # Create workflow
    workflow = Workflow(
        name="Test Workflow", description="Test", is_default=True, created_by=1
    )
    db_session.add(workflow)
    await db_session.flush()

    # Create multiple requests
    requests = []
    for i in range(5):
        request = Request(
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
    jobs = []

    for request in requests:
        job_id = await job_service.create_job(
            request_id=request.id, job_type=JobType.WORKFLOW, workflow_id=workflow.id
        )
        jobs.append((request.id, job_id))

    await db_session.commit()

    # Simulate staggered job completions
    completion_order = []

    for idx, (request_id, job_id) in enumerate(jobs):
        # Stagger completions by 200ms each
        await asyncio.sleep(0.2)

        # Get and update job
        job_result = await db_session.execute(
            select(ProcessingJob).where(ProcessingJob.id == job_id)
        )
        job = job_result.scalar_one()

        # Transition through states quickly
        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        await db_session.commit()

        await asyncio.sleep(0.1)  # Brief processing

        job.status = JobStatus.COMPLETED
        job.completed_at = datetime.now(timezone.utc)
        await db_session.commit()

        completion_order.append((request_id, time.time()))

        # Check how many jobs are still active
        active_result = await db_session.execute(
            select(ProcessingJob).where(
                ProcessingJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING])
            )
        )
        active_count = len(active_result.scalars().all())

        print(
            f"Completed job for request {request_id}, {active_count} jobs still active"
        )

    # Verify all jobs completed
    final_result = await db_session.execute(
        select(ProcessingJob).where(ProcessingJob.status == JobStatus.COMPLETED)
    )
    completed_jobs = final_result.scalars().all()

    assert (
        len(completed_jobs) == 5
    ), f"Expected 5 completed jobs, got {len(completed_jobs)}"

    # Verify no jobs are stuck
    stuck_result = await db_session.execute(
        select(ProcessingJob).where(
            ProcessingJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING])
        )
    )
    stuck_jobs = stuck_result.scalars().all()

    assert len(stuck_jobs) == 0, f"Found {len(stuck_jobs)} stuck jobs"
