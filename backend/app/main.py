from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Histogram
from prometheus_client import start_http_server
import structlog
import time
from app.config import settings
from app.routers import requests, jobs, internal, config, workflows, logs, custom_instructions, export, ground_truth, user_preferences, exercises
try:
    from app.routers import config_api
except ImportError:
    config_api = None

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
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Prometheus metrics
REQUEST_COUNT = Counter('api_requests_total', 'Total API requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('api_request_duration_seconds', 'API request duration')

app = FastAPI(
    title="TaskFlow Processing API",
    description="Internal API for task processing with AI analysis",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None
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
        client_host=request.client.host if request.client else None
    )
    
    response = await call_next(request)
    
    # Calculate duration
    duration = time.time() - start_time
    
    # Record metrics
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    REQUEST_DURATION.observe(duration)
    
    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        duration_ms=round(duration * 1000, 2)
    )
    
    return response


@app.get("/test-endpoint")
async def test_endpoint():
    """Test endpoint"""
    return {"status": "working"}

@app.get("/api/models/ollama")
async def get_available_models():
    """Get available models from Ollama"""
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("http://taskflow-ollama:11434/api/tags")
            if response.status_code == 200:
                data = response.json()
                models = []
                for model in data.get("models", []):
                    models.append({
                        "name": model["name"],
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at"),
                        "digest": model.get("digest"),
                        "details": model.get("details", {})
                    })
                return {"models": models, "total": len(models)}
            else:
                return {"models": [], "total": 0, "error": "Failed to fetch models from Ollama"}
    except Exception as e:
        return {"models": [], "total": 0, "error": str(e)}

# Include routers
app.include_router(requests.router)
app.include_router(jobs.router)
app.include_router(internal.router)
app.include_router(config.router)
app.include_router(workflows.router)
app.include_router(exercises.router)
app.include_router(custom_instructions.router)
app.include_router(logs.router)
app.include_router(export.router)
app.include_router(ground_truth.router)
app.include_router(user_preferences.router)
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
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

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
        reload=settings.debug
    )