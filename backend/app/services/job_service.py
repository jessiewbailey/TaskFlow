import uuid
import asyncio
from typing import Optional, Set
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.schemas import ProcessingJob, JobStatus, JobType, Request, RequestStatus
from app.models.pydantic_models import JobProgressResponse
import httpx
from app.config import settings
import structlog

logger = structlog.get_logger()

# Global job queue manager
class JobQueueManager:
    def __init__(self, max_concurrent_jobs: int = 4):
        self.max_concurrent_jobs = max_concurrent_jobs
        self.running_jobs: Set[str] = set()
        self.job_queue: asyncio.Queue = asyncio.Queue()
        self.queue_processor_task: Optional[asyncio.Task] = None
        
    async def start(self):
        """Start the queue processor if not already running"""
        if self.queue_processor_task is None or self.queue_processor_task.done():
            self.queue_processor_task = asyncio.create_task(self._process_queue())
            logger.info("Started job queue processor")
    
    async def add_job(self, job_id: str, job_coro):
        """Add a job to the queue"""
        await self.job_queue.put((job_id, job_coro))
        logger.info(f"Added job {job_id} to queue. Queue size: {self.job_queue.qsize()}")
        
    async def _process_queue(self):
        """Process jobs from the queue with concurrency control"""
        while True:
            try:
                # Wait if we're at max capacity
                while len(self.running_jobs) >= self.max_concurrent_jobs:
                    await asyncio.sleep(0.5)
                
                # Get next job from queue
                job_id, job_coro = await self.job_queue.get()
                
                # Start the job
                self.running_jobs.add(job_id)
                logger.info(f"Starting job {job_id}. Running jobs: {len(self.running_jobs)}")
                
                # Run job and remove from running set when done
                task = asyncio.create_task(self._run_job(job_id, job_coro))
                
            except Exception as e:
                logger.error(f"Error in queue processor: {str(e)}")
                await asyncio.sleep(1)  # Prevent tight loop on error
    
    async def _run_job(self, job_id: str, job_coro):
        """Run a job and clean up when done"""
        try:
            await job_coro
        finally:
            self.running_jobs.discard(job_id)
            logger.info(f"Completed job {job_id}. Running jobs: {len(self.running_jobs)}")

# Initialize global job queue manager
job_queue_manager = JobQueueManager(max_concurrent_jobs=4)

class JobService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_job(
        self, 
        request_id: int, 
        job_type: JobType = JobType.STANDARD,
        custom_instructions: Optional[str] = None,
        workflow_id: Optional[int] = None
    ) -> str:
        """Create a new processing job"""
        job_id = uuid.uuid4()
        
        job = ProcessingJob(
            id=job_id,
            request_id=request_id,
            workflow_id=workflow_id,
            job_type=job_type,
            custom_instructions=custom_instructions,
            status=JobStatus.PENDING
        )
        
        self.db.add(job)
        await self.db.commit()  # Commit immediately to ensure job exists for background task
        
        # Ensure queue processor is running
        await job_queue_manager.start()
        
        # Add job to queue instead of starting immediately
        await job_queue_manager.add_job(str(job_id), self._process_job(str(job_id)))
        
        return str(job_id)

    async def get_job_status(self, job_id: str) -> Optional[JobProgressResponse]:
        """Get job status and progress"""
        result = await self.db.execute(
            select(ProcessingJob).where(ProcessingJob.id == job_id)
        )
        job = result.scalar_one_or_none()
        
        if not job:
            return None
            
        return JobProgressResponse(
            job_id=str(job.id),
            request_id=job.request_id,
            status=job.status,
            error_message=job.error_message,
            started_at=job.started_at,
            completed_at=job.completed_at,
            created_at=job.created_at
        )

    async def _process_job(self, job_id: str):
        """Process job asynchronously by calling AI worker"""
        # Import here to avoid circular imports
        from app.models.database import get_db_session
        
        try:
            # Add a small delay to ensure the job creation transaction is fully committed
            await asyncio.sleep(0.1)
            
            # Use a new database session for background processing
            async with get_db_session() as db:
                # Update job status to RUNNING
                await db.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id == job_id)
                    .values(status=JobStatus.RUNNING, started_at=datetime.utcnow())
                )
                await db.commit()
                
                # Get job details
                result = await db.execute(
                    select(ProcessingJob).where(ProcessingJob.id == job_id)
                )
                job = result.scalar_one_or_none()
                
                if not job:
                    raise ValueError(f"Job {job_id} not found in database")
                
                logger.info("Processing job", job_id=job_id, request_id=job.request_id, 
                           job_type=job.job_type.value, workflow_id=job.workflow_id)
                
                # Call AI worker
                async with httpx.AsyncClient(timeout=600.0) as client:  # 10 minutes timeout for long-running jobs
                    payload = {
                        "request_id": job.request_id,
                        "job_type": job.job_type.value,
                        "custom_instructions": job.custom_instructions,
                        "workflow_id": job.workflow_id
                    }
                    
                    logger.info("Sending request to AI worker", 
                               ai_worker_url=settings.ai_worker_url, payload=payload)
                    
                    response = await client.post(
                        f"{settings.ai_worker_url}/process",
                        json=payload
                    )
                    response.raise_for_status()
                    
                    logger.info("AI worker response received", 
                               status_code=response.status_code)
                
                # Update job status to COMPLETED
                await db.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id == job_id)
                    .values(status=JobStatus.COMPLETED, completed_at=datetime.utcnow())
                )
                await db.commit()
                
                logger.info("Job completed successfully", job_id=job_id)
                
        except Exception as e:
            logger.error("Job processing failed", job_id=job_id, error=str(e))
            
            # Update job status to FAILED with a new session
            async with get_db_session() as db:
                await db.execute(
                    update(ProcessingJob)
                    .where(ProcessingJob.id == job_id)
                    .values(
                        status=JobStatus.FAILED, 
                        completed_at=datetime.utcnow(),
                        error_message=str(e)
                    )
                )
                await db.commit()