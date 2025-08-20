import structlog
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from app.services.log_service import log_streaming_service

logger = structlog.get_logger()
router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.websocket("/ollama/stream")
async def ollama_logs_websocket(websocket: WebSocket):
    """WebSocket endpoint for streaming Ollama logs"""
    await websocket.accept()

    try:
        logger.info("New WebSocket connection for Ollama logs")

        # Start streaming logs
        async for log_entry in log_streaming_service.stream_ollama_logs(websocket):
            # The streaming is handled in the service
            pass

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for Ollama logs")
    except Exception as e:
        logger.error("WebSocket error for Ollama logs", error=str(e))
    finally:
        log_streaming_service.disconnect_websocket(websocket)


@router.get("/ollama/recent")
async def get_recent_ollama_logs(lines: int = Query(100, ge=1, le=1000)):
    """Get recent Ollama logs"""
    try:
        logs = await log_streaming_service.get_recent_logs(lines)
        return {"logs": logs, "total": len(logs), "container": "taskflow-ollama"}
    except Exception as e:
        logger.error("Error fetching recent Ollama logs", error=str(e))
        return JSONResponse(status_code=500, content={"detail": "Failed to fetch recent logs"})


@router.get("/ollama/status")
async def get_ollama_status():
    """Get Ollama container status"""
    try:
        import asyncio

        import docker
        from docker.errors import DockerException

        def _get_status():
            client = docker.from_env()
            container = client.containers.get("taskflow-ollama")
            status = container.status
            client.close()
            return status

        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        status = await loop.run_in_executor(None, _get_status)

        return {
            "container": "taskflow-ollama",
            "status": status,
            "running": status == "running",
        }

    except DockerException as e:
        logger.error("Docker error checking Ollama status", error=str(e))
        return {
            "container": "taskflow-ollama",
            "status": "not_found",
            "running": False,
            "error": str(e),
        }
    except Exception as e:
        logger.error("Error checking Ollama status", error=str(e))
        return JSONResponse(status_code=500, content={"detail": "Failed to check container status"})
