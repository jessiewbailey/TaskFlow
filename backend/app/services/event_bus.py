"""
Event Bus service for real-time communication using Redis Pub/Sub
"""
import json
import asyncio
from typing import Dict, Any, AsyncGenerator, Callable, Set
from contextlib import asynccontextmanager
import redis.asyncio as redis
from app.config import settings
import structlog

logger = structlog.get_logger()

class EventBus:
    """Redis-based event bus for publishing and subscribing to events"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.redis_url
        self._redis_client = None
        self._pubsub = None
        self._subscribers: Dict[str, Set[Callable]] = {}
        self._running = False
        self._listener_task = None
        
    async def connect(self):
        """Connect to Redis"""
        if not self._redis_client:
            self._redis_client = redis.from_url(self.redis_url)
            self._pubsub = self._redis_client.pubsub()
            logger.info("Connected to Redis event bus", url=self.redis_url)
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self._pubsub:
            await self._pubsub.close()
        if self._redis_client:
            await self._redis_client.close()
        logger.info("Disconnected from Redis event bus")
    
    async def publish(self, channel: str, event: Dict[str, Any]):
        """Publish an event to a channel"""
        if not self._redis_client:
            await self.connect()
        
        message = json.dumps(event)
        await self._redis_client.publish(channel, message)
        
        logger.debug("Published event", channel=channel, event_type=event.get('type'))
        
        # Trigger webhooks asynchronously
        asyncio.create_task(self._trigger_webhooks(event))
    
    async def _trigger_webhooks(self, event: Dict[str, Any]):
        """Trigger webhooks for an event"""
        try:
            # Import here to avoid circular imports
            from app.models.database import get_db_session
            from app.services.webhook_service import WebhookService
            
            webhook_event_type = event.get("type")
            if webhook_event_type:
                async with get_db_session() as db:
                    service = WebhookService(db)
                    await service.trigger_webhooks(webhook_event_type, event)
        except Exception as e:
            logger.error(f"Failed to trigger webhooks: {str(e)}")
    
    async def subscribe(self, pattern: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Subscribe to channels matching a pattern and yield events"""
        if not self._pubsub:
            await self.connect()
        
        await self._pubsub.psubscribe(pattern)
        logger.info("Subscribed to pattern", pattern=pattern)
        
        try:
            async for message in self._pubsub.listen():
                if message['type'] == 'pmessage':
                    try:
                        data = json.loads(message['data'])
                        yield {
                            'channel': message['channel'].decode(),
                            'pattern': message['pattern'].decode(),
                            'data': data
                        }
                    except json.JSONDecodeError:
                        logger.error("Failed to decode message", 
                                   channel=message['channel'], 
                                   data=message['data'])
        finally:
            await self._pubsub.punsubscribe(pattern)

# Event types for type safety
class EventType:
    # Job events
    JOB_STARTED = "job.started"
    JOB_PROGRESS = "job.progress"
    JOB_COMPLETED = "job.completed"
    JOB_FAILED = "job.failed"
    
    # Embedding events
    EMBEDDING_STARTED = "embedding.started"
    EMBEDDING_PROGRESS = "embedding.progress"
    EMBEDDING_COMPLETED = "embedding.completed"
    EMBEDDING_FAILED = "embedding.failed"
    
    # Workflow events
    WORKFLOW_STARTED = "workflow.started"
    WORKFLOW_STEP_STARTED = "workflow.step.started"
    WORKFLOW_STEP_COMPLETED = "workflow.step.completed"
    WORKFLOW_COMPLETED = "workflow.completed"
    WORKFLOW_FAILED = "workflow.failed"
    
    # Request events
    REQUEST_CREATED = "request.created"
    REQUEST_UPDATED = "request.updated"
    REQUEST_STATUS_CHANGED = "request.status.changed"
    REQUEST_ASSIGNED = "request.assigned"

# Helper functions for standard event structure
def create_event(event_type: str, request_id: int, payload: Dict[str, Any] = None) -> Dict[str, Any]:
    """Create a standardized event structure"""
    from datetime import datetime
    
    event = {
        "type": event_type,
        "request_id": request_id,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    if payload:
        event["payload"] = payload
    
    return event

def get_channel_for_request(request_id: int) -> str:
    """Get the Redis channel name for a specific request"""
    return f"taskflow.request.{request_id}"

def get_channel_pattern_for_all_requests() -> str:
    """Get the Redis pattern to subscribe to all request events"""
    return "taskflow.request.*"

# Global event bus instance
event_bus = EventBus()

@asynccontextmanager
async def get_event_bus():
    """Context manager for event bus connection"""
    await event_bus.connect()
    try:
        yield event_bus
    finally:
        pass  # Keep connection alive for reuse