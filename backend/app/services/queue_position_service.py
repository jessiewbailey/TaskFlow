"""Service for calculating queue positions from database state"""

import logging
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import JobStatus, ProcessingJob

logger = logging.getLogger(__name__)


class QueuePositionService:
    """Calculate job queue positions from database state"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_queue_position(self, job_id: str) -> Optional[int]:
        """
        Get the queue position of a job.

        Returns:
        - None if job not found
        - -1 if job is running or completed
        - 0+ for position in queue (0 = next to run)
        """
        # Get the job
        result = await self.db.execute(
            select(ProcessingJob).where(ProcessingJob.id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            return None

        # If job is not pending, it doesn't have a queue position
        if job.status != JobStatus.PENDING:
            return -1

        # Count how many pending jobs are ahead of this one
        # Jobs are processed in order of creation (FIFO)
        count_result = await self.db.execute(
            select(func.count(ProcessingJob.id))
            .where(ProcessingJob.status == JobStatus.PENDING)
            .where(ProcessingJob.created_at < job.created_at)
        )
        position = count_result.scalar()

        return position

    async def get_running_job_count(self) -> int:
        """Get the number of currently running jobs"""
        result = await self.db.execute(
            select(func.count(ProcessingJob.id)).where(
                ProcessingJob.status == JobStatus.RUNNING
            )
        )
        return result.scalar() or 0

    async def get_pending_job_count(self) -> int:
        """Get the number of pending jobs"""
        result = await self.db.execute(
            select(func.count(ProcessingJob.id)).where(
                ProcessingJob.status == JobStatus.PENDING
            )
        )
        return result.scalar() or 0

    async def estimate_wait_time(self, job_id: str) -> Optional[int]:
        """
        Estimate wait time in seconds for a job.
        This is a rough estimate based on average processing time.
        """
        position = await self.get_queue_position(job_id)

        if position is None or position < 0:
            return None

        # Get average processing time for completed jobs in the last hour
        from datetime import datetime, timedelta, timezone

        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

        avg_time_result = await self.db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch", ProcessingJob.completed_at - ProcessingJob.started_at
                    )
                )
            )
            .where(ProcessingJob.status == JobStatus.COMPLETED)
            .where(ProcessingJob.completed_at >= one_hour_ago)
            .where(ProcessingJob.started_at.isnot(None))
            .where(ProcessingJob.completed_at.isnot(None))
        )
        avg_processing_time = avg_time_result.scalar()

        if not avg_processing_time:
            # Default to 30 seconds if no data
            avg_processing_time = 30

        # Get number of running jobs
        running_count = await self.get_running_job_count()
        max_concurrent = 4  # This should come from config

        # Estimate based on position and concurrency
        if running_count < max_concurrent:
            # Some slots are free, job might start soon
            estimated_wait = position * avg_processing_time / max_concurrent
        else:
            # All slots full, need to wait for current jobs
            estimated_wait = (position + 1) * avg_processing_time / max_concurrent

        return int(estimated_wait)
