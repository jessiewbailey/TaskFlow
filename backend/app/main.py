import asyncio
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
    start_http_server,
)

from app.config import settings
from app.routers import (
    custom_instructions,
    exercises,
    export,
    ground_truth,
    internal,
    jobs,
    logs,
    rag_search,
    requests,
)
from app.routers import settings as settings_router
from app.routers import user_preferences, webhooks, workflow_embedding, workflows

try:
    from app.routers import config_api
except ImportError:
    config_api = None  # type: ignore

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter(
    "api_requests_total", "Total API requests", ["method", "endpoint", "status"]
)
REQUEST_DURATION = Histogram("api_request_duration_seconds", "API request duration")


# Background task for checking stuck jobs
async def check_stuck_jobs():
    """Periodically check for stuck PENDING jobs and retry them"""
    from datetime import datetime, timedelta

    from sqlalchemy import and_, select

    from app.models.database import get_db_session
    from app.models.schemas import JobStatus, ProcessingJob
    from app.services.job_service import JobService, job_queue_manager

    while True:
        try:
            await asyncio.sleep(60)  # Check every 60 seconds instead of 30

            async with get_db_session() as db:
                # Find jobs that have been PENDING for more than 5 minutes (increased from 2)
                cutoff_time = datetime.utcnow() - timedelta(minutes=5)

                # Also check that job is not already being processed (started_at is null)
                # and that it hasn't already completed or failed
                # Skip jobs that have retry_count > 0 as they're being retried
                result = await db.execute(
                    select(ProcessingJob).where(
                        and_(
                            ProcessingJob.status == JobStatus.PENDING,
                            ProcessingJob.created_at < cutoff_time,
                            ProcessingJob.started_at.is_(None),  # Never started
                            ProcessingJob.completed_at.is_(None),  # Never completed
                            ProcessingJob.retry_count == 0,  # Not a retry
                        )
                    )
                )
                stuck_jobs = result.scalars().all()

                if stuck_jobs:
                    logger.info(f"Found {len(stuck_jobs)} genuinely stuck PENDING jobs")
                    job_service = JobService(db)

                    for job in stuck_jobs:
                        # Double-check the job is still PENDING (avoid race conditions)
                        current_job_result = await db.execute(
                            select(ProcessingJob).where(ProcessingJob.id == job.id)
                        )
                        current_job = current_job_result.scalar_one_or_none()

                        if current_job and current_job.status == JobStatus.PENDING:
                            # Re-queue the job
                            logger.info(
                                f"Re-queuing stuck job {job.id} "
                                f"(created {job.created_at}, never started)"
                            )
                            await job_queue_manager.add_job(
                                str(job.id), job_service._process_job(str(job.id))
                            )
                        else:
                            logger.info(
                                f"Job {job.id} status changed to "
                                f"{current_job.status if current_job else 'deleted'}, "
                                f"skipping re-queue"
                            )

        except Exception as e:
            logger.error(f"Error checking stuck jobs: {str(e)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting TaskFlow API")

    # Start the job queue manager
    from app.services.job_service import job_queue_manager

    await job_queue_manager.start()

    # Initialize event bus and bridge
    from app.services.event_bridge import event_bridge
    from app.services.event_bus import event_bus

    await event_bus.connect()
    await event_bridge.start()

    # Start background task for checking stuck jobs
    stuck_job_checker = asyncio.create_task(check_stuck_jobs())

    yield

    # Shutdown
    logger.info("Shutting down TaskFlow API")
    stuck_job_checker.cancel()
    try:
        await stuck_job_checker
    except asyncio.CancelledError:
        pass

    # Stop event bridge and bus
    await event_bridge.stop()
    await event_bus.disconnect()


app = FastAPI(
    title="TaskFlow Processing API",
    description="Internal API for task processing with AI analysis",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging and metrics middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    start_time = time.time()

    # Log request
    logger.info(
        "Request started",
        method=request.method,
        url=str(request.url),
        client_host=request.client.host if request.client else None,
    )

    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Record metrics
    REQUEST_COUNT.labels(
        method=request.method, endpoint=request.url.path, status=response.status_code
    ).inc()
    REQUEST_DURATION.observe(duration)

    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        duration_ms=round(duration * 1000, 2),
    )

    return response


@app.get("/test-endpoint")
async def test_endpoint():
    """Test endpoint"""
    return {"status": "working"}


@app.get("/api/models/ollama")
async def get_available_models():
    """Get available models from Ollama"""
    import os

    import httpx

    try:
        ollama_host = os.getenv("OLLAMA_HOST", "http://ollama-service:11434")
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{ollama_host}/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("models", []):
                    models.append(
                        {
                            "name": model["name"],
                            "size": model.get("size", 0),
                            "modified_at": model.get("modified_at"),
                            "digest": model.get("digest"),
                            "details": model.get("details", {}),
                        }
                    )
                return {"models": models, "total": len(models)}
            else:
                return {
                    "models": [],
                    "total": 0,
                    "error": "Failed to fetch models from Ollama",
                }
    except Exception as e:
        return {"models": [], "total": 0, "error": str(e)}


# Include routers
app.include_router(requests.router)
app.include_router(jobs.router)
app.include_router(internal.router)
# Include workflow_embedding before workflows to avoid route conflicts
app.include_router(workflow_embedding.router)
app.include_router(workflows.router)
app.include_router(exercises.router)
app.include_router(custom_instructions.router)
app.include_router(logs.router)
app.include_router(export.router)
app.include_router(ground_truth.router)
app.include_router(user_preferences.router)
app.include_router(settings_router.router)
app.include_router(rag_search.router)
app.include_router(webhooks.router)
if config_api:
    app.include_router(config_api.router)


@app.get("/healthz")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "taskflow-api"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(
        "Unhandled exception",
        url=str(request.url),
        method=request.method,
        error=str(exc),
        exc_info=True,
    )

    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info("Starting TaskFlow API service")

    # Start Prometheus metrics server
    if settings.prometheus_port:
        start_http_server(settings.prometheus_port)
        logger.info("Prometheus metrics server started", port=settings.prometheus_port)


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("Shutting down TaskFlow API service")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
