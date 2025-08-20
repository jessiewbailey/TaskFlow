import asyncio
import json

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.pydantic_models import JobProgressResponse
from app.models.schemas import ProcessingJob
from app.services.job_service import JobService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get job status and progress"""

    job_service = JobService(db)
    job_status = await job_service.get_job_status(job_id)

    if not job_status:
        raise HTTPException(status_code=404, detail="Job not found")

    return job_status


@router.get("/{job_id}/stream")
async def stream_job_progress(job_id: str, db: AsyncSession = Depends(get_db)):
    """Stream job progress using Server-Sent Events"""

    async def event_generator():
        job_service = JobService(db)
        last_status = None

        while True:
            try:
                job_status = await job_service.get_job_status(job_id)

                if not job_status:
                    yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                    break

                # Only send updates when status changes
                current_status = job_status.status
                if current_status != last_status:
                    data = {
                        "job_id": job_status.job_id,
                        "request_id": job_status.request_id,
                        "status": job_status.status.value,
                        "error_message": job_status.error_message,
                        "started_at": (
                            job_status.started_at.isoformat()
                            if job_status.started_at
                            else None
                        ),
                        "completed_at": (
                            job_status.completed_at.isoformat()
                            if job_status.completed_at
                            else None
                        ),
                        "created_at": job_status.created_at.isoformat(),
                    }

                    yield f"data: {json.dumps(data)}\n\n"
                    last_status = current_status

                # Stop streaming if job is completed or failed
                if current_status in ["COMPLETED", "FAILED"]:
                    break

                # Wait before next poll
                await asyncio.sleep(2)

            except Exception as e:
                logger.error(
                    "Error streaming job progress", job_id=job_id, error=str(e)
                )
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.delete("/purge")
async def purge_all_jobs(db: AsyncSession = Depends(get_db)):
    """Delete all processing jobs from the system"""

    try:
        # Get count before deletion
        count_result = await db.execute(func.count(ProcessingJob.id))
        total_jobs = count_result.scalar()

        # Delete all processing jobs
        result = await db.execute(delete(ProcessingJob))
        deleted_count = result.rowcount

        await db.commit()

        logger.info(
            "Purged all processing jobs",
            total_jobs=total_jobs,
            deleted_count=deleted_count,
        )

        return {
            "success": True,
            "deleted_count": deleted_count,
            "message": f"Successfully deleted {deleted_count} processing jobs",
        }

    except Exception as e:
        await db.rollback()
        logger.error("Failed to purge jobs", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to purge jobs: {str(e)}")
