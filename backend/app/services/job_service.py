import uuid
import asyncio
from typing import Optional, Set
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_
from app.models.schemas import ProcessingJob, JobStatus, JobType, Request, RequestStatus, WorkflowEmbeddingConfig, AIOutput
from app.models.pydantic_models import JobProgressResponse
import httpx
from app.config import settings
import structlog
import json
import re
from app.models.database import get_db_session
from app.services.event_bus import event_bus

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
    
    def get_queue_position(self, job_id: str) -> int:
        """Get the position of a job in the queue (0-based, -1 if not found or running)"""
        if job_id in self.running_jobs:
            return -1  # Job is already running
        
        # Convert queue to list to find position
        queue_items = list(self.job_queue._queue)
        for i, (queued_job_id, _) in enumerate(queue_items):
            if queued_job_id == job_id:
                return i
        
        return -1  # Job not found in queue
        
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

    def _get_max_retries(self, job_type: JobType) -> int:
        """Get maximum retry count based on job type"""
        if job_type == JobType.EMBEDDING:
            return 3  # More retries for lightweight embedding jobs
        elif job_type == JobType.WORKFLOW:
            return 2  # Fewer retries for heavy workflow jobs
        elif job_type == JobType.BULK_EMBEDDING:
            return 1  # Minimal retries for bulk operations
        else:
            return 2  # Default retry count
    
    async def _process_job(self, job_id: str):
        """Process job asynchronously by calling AI worker"""
        # Import here to avoid circular imports
        from app.models.database import get_db_session
        
        try:
            # Add a small delay to ensure the job creation transaction is fully committed
            await asyncio.sleep(0.1)
            
            # Use a new database session for background processing
            async with get_db_session() as db:
                # First check if job is still PENDING before processing
                result = await db.execute(
                    select(ProcessingJob).where(ProcessingJob.id == job_id)
                )
                job = result.scalar_one_or_none()
                
                if not job:
                    logger.error(f"Job {job_id} not found")
                    return
                
                if job.status != JobStatus.PENDING:
                    logger.warning(f"Job {job_id} is not PENDING (status: {job.status}), skipping processing")
                    return
                
                # Update job status to RUNNING only if it's still PENDING
                result = await db.execute(
                    update(ProcessingJob)
                    .where(
                        ProcessingJob.id == job_id,
                        ProcessingJob.status == JobStatus.PENDING  # Ensure it's still PENDING
                    )
                    .values(status=JobStatus.RUNNING, started_at=datetime.now(timezone.utc))
                    .returning(ProcessingJob.id)
                )
                await db.commit()
                
                # If no rows were updated, the job status changed
                if not result.scalar_one_or_none():
                    logger.warning(f"Job {job_id} status changed during update, skipping processing")
                    return
                
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
                    .values(status=JobStatus.COMPLETED, completed_at=datetime.now(timezone.utc))
                )
                await db.commit()
                
                logger.info("Job completed successfully", job_id=job_id)
                
                # Generate embedding after successful workflow completion
                await self._generate_workflow_embedding(job.request_id, job.workflow_id, db)
                
                # Clean up old completed jobs to prevent status confusion
                await self._cleanup_old_jobs(job.request_id, db)
                
        except Exception as e:
            logger.error("Job processing failed", job_id=job_id, error=str(e))
            
            # Handle retry logic
            async with get_db_session() as db:
                # Get current job details
                result = await db.execute(
                    select(ProcessingJob).where(ProcessingJob.id == job_id)
                )
                job = result.scalar_one_or_none()
                
                if job and job.status == JobStatus.RUNNING and job.retry_count < self._get_max_retries(job.job_type):
                    # Only retry if job is still RUNNING (not if it's already COMPLETED or FAILED)
                    # Increment retry count and set back to PENDING for retry
                    await db.execute(
                        update(ProcessingJob)
                        .where(
                            ProcessingJob.id == job_id,
                            ProcessingJob.status == JobStatus.RUNNING  # Ensure it's still RUNNING
                        )
                        .values(
                            status=JobStatus.PENDING,
                            retry_count=job.retry_count + 1,
                            error_message=f"Retry {job.retry_count + 1}: {str(e)}",
                            started_at=None  # Reset started_at for retry
                        )
                    )
                    await db.commit()
                    
                    # Calculate backoff delay
                    delay = min(2 ** job.retry_count, 60)  # Exponential backoff, max 60 seconds
                    logger.info(f"Job {job_id} will be retried after {delay} seconds (attempt {job.retry_count + 1})")
                    
                    # Re-queue the job with delay
                    await asyncio.sleep(delay)
                    await job_queue_manager.add_job(str(job_id), self._process_job(str(job_id)))
                else:
                    # Max retries exceeded or job status changed, mark as FAILED only if still RUNNING
                    if job and job.status == JobStatus.RUNNING:
                        await db.execute(
                            update(ProcessingJob)
                            .where(
                                ProcessingJob.id == job_id,
                                ProcessingJob.status == JobStatus.RUNNING  # Ensure it's still RUNNING
                            )
                            .values(
                                status=JobStatus.FAILED, 
                                completed_at=datetime.now(timezone.utc),
                                error_message=str(e)
                            )
                        )
                        await db.commit()
                        logger.error(f"Job {job_id} failed after {job.retry_count + 1} attempts")
                    else:
                        logger.warning(f"Job {job_id} status is {job.status if job else 'None'}, not updating to FAILED")
    
    async def _generate_workflow_embedding(self, request_id: str, workflow_id: int, db: AsyncSession):
        """Generate embedding based on workflow configuration after successful completion"""
        try:
            # Get embedding configuration for the workflow
            config_result = await db.execute(
                select(WorkflowEmbeddingConfig)
                .where(WorkflowEmbeddingConfig.workflow_id == workflow_id)
            )
            embedding_config = config_result.scalar_one_or_none()
            
            # Skip if no config or embedding disabled
            if not embedding_config or not embedding_config.enabled:
                logger.info("Embedding generation skipped", 
                           request_id=request_id, 
                           reason="disabled or no config")
                return
            
            # Get request data
            request_result = await db.execute(
                select(Request).where(Request.id == request_id)
            )
            request = request_result.scalar_one_or_none()
            if not request:
                logger.error("Request not found for embedding generation", request_id=request_id)
                return
            
            # Get AI output for this request
            output_query = await db.execute(
                select(AIOutput)
                .where(AIOutput.request_id == request_id)
                .order_by(AIOutput.version.desc())
            )
            ai_output = output_query.scalars().first()
            
            # Build context dictionary for template replacement
            context = {
                "REQUEST_TEXT": request.text
            }
            
            # Add AI output to context if available
            if ai_output and ai_output.summary:
                try:
                    # Parse the summary JSON which contains all workflow outputs
                    summary_data = json.loads(ai_output.summary)
                    
                    # Add each block's output to context
                    for block_name, block_data in summary_data.items():
                        if isinstance(block_data, dict):
                            # Add individual fields
                            for key, value in block_data.items():
                                context[f"{block_name}.{key}"] = str(value)
                            # Also add the full block data as JSON
                            context[block_name] = json.dumps(block_data)
                        else:
                            # If not a dict, just add as string
                            context[block_name] = str(block_data)
                except Exception as e:
                    logger.warning("Failed to parse AI output summary", 
                                 request_id=request_id, 
                                 error=str(e))
            
            # Process the template
            embedding_text = embedding_config.embedding_template
            
            # Replace all variables in the template
            for var_match in re.findall(r'\{\{([^}]+)\}\}', embedding_text):
                var_name = var_match.strip()
                if var_name in context:
                    embedding_text = embedding_text.replace(f"{{{{{var_name}}}}}", context[var_name])
                else:
                    # Handle nested field access (e.g., BlockName.field)
                    embedding_text = embedding_text.replace(f"{{{{{var_name}}}}}", "")
            
            # Generate embedding via embedding service
            if embedding_text.strip():
                await self._send_to_embedding_service(request_id, embedding_text)
                logger.info("Embedding generation initiated", 
                           request_id=request_id,
                           text_length=len(embedding_text))
            else:
                logger.warning("Empty embedding text after template processing", 
                              request_id=request_id)
                
        except Exception as e:
            logger.error("Failed to generate workflow embedding", 
                        request_id=request_id, 
                        error=str(e))
    
    async def _cleanup_old_jobs(self, request_id: str, db: AsyncSession):
        """Clean up old completed jobs to prevent UI status confusion"""
        try:
            from datetime import timedelta
            
            # Keep only the 3 most recent jobs per request to maintain history
            # but remove excess older jobs that can cause status confusion
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
            
            # Subquery to get job IDs to keep (most recent 3 per request)
            keep_jobs_subquery = (
                select(ProcessingJob.id)
                .where(ProcessingJob.request_id == request_id)
                .order_by(ProcessingJob.created_at.desc())
                .limit(3)
            )
            
            # Delete old jobs that are not in the keep list and are older than 24 hours
            delete_result = await db.execute(
                delete(ProcessingJob)
                .where(
                    and_(
                        ProcessingJob.request_id == request_id,
                        ProcessingJob.status.in_([JobStatus.COMPLETED, JobStatus.FAILED]),
                        ProcessingJob.created_at < cutoff_time,
                        ProcessingJob.id.notin_(keep_jobs_subquery)
                    )
                )
            )
            
            deleted_count = delete_result.rowcount
            if deleted_count > 0:
                await db.commit()
                logger.info("Cleaned up old jobs", 
                           request_id=request_id, 
                           deleted_count=deleted_count)
                           
        except Exception as e:
            logger.error("Failed to cleanup old jobs", 
                        request_id=request_id, 
                        error=str(e))
    
    async def _send_to_embedding_service(self, request_id: str, text: str):
        """Send text to embedding service for vector generation"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{settings.embedding_service_url}/embed",
                    json={
                        "request_id": request_id,
                        "text": text
                    }
                )
                response.raise_for_status()
                logger.info("Sent to embedding service", request_id=request_id)
        except Exception as e:
            logger.error("Failed to send to embedding service", 
                        request_id=request_id, 
                        error=str(e))