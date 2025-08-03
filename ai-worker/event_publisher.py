"""
Event publisher for AI worker to send progress updates via Redis
"""
import json
import redis.asyncio as redis
from typing import Dict, Any, Optional
from datetime import datetime
import os
import structlog

logger = structlog.get_logger()

class EventPublisher:
    """Publishes events to Redis for real-time updates"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://redis:6379/0")
        self._redis_client = None
        
    async def connect(self):
        """Connect to Redis"""
        if not self._redis_client:
            self._redis_client = redis.from_url(self.redis_url)
            logger.info("Connected to Redis for event publishing", url=self.redis_url)
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self._redis_client:
            await self._redis_client.close()
            logger.info("Disconnected from Redis")
    
    async def publish_event(self, request_id: int, event_type: str, payload: Dict[str, Any] = None):
        """Publish an event for a specific request"""
        if not self._redis_client:
            await self.connect()
        
        event = {
            "type": event_type,
            "request_id": request_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if payload:
            event["payload"] = payload
        
        channel = f"taskflow.request.{request_id}"
        message = json.dumps(event)
        
        await self._redis_client.publish(channel, message)
        logger.debug("Published event", channel=channel, event_type=event_type)
    
    # Convenience methods for common events
    async def job_started(self, request_id: int, job_type: str, job_id: str = None):
        await self.publish_event(request_id, "job.started", {
            "job_type": job_type,
            "job_id": job_id
        })
    
    async def job_progress(self, request_id: int, progress: float, message: str = None):
        await self.publish_event(request_id, "job.progress", {
            "progress": progress,
            "message": message
        })
    
    async def job_completed(self, request_id: int, job_type: str, result: Any = None):
        await self.publish_event(request_id, "job.completed", {
            "job_type": job_type,
            "result": result
        })
    
    async def job_failed(self, request_id: int, job_type: str, error: str):
        await self.publish_event(request_id, "job.failed", {
            "job_type": job_type,
            "error": error
        })
    
    async def embedding_progress(self, request_id: int, status: str, progress: float = None, message: str = None):
        await self.publish_event(request_id, "embedding.progress", {
            "status": status,
            "progress": progress,
            "message": message
        })
    
    async def workflow_step_completed(self, request_id: int, step_name: str, result: Any = None):
        await self.publish_event(request_id, "workflow.step.completed", {
            "step_name": step_name,
            "result": result
        })

# Global event publisher instance
event_publisher = EventPublisher()