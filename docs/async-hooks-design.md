# Async Communication Hooks Design for TaskFlow

## Overview

The current implementation uses a simple HTTP callback, but we can implement more sophisticated hook systems for better async communication between components:

1. **AI Worker → API**: Progress updates, completion notifications
2. **API → UI**: Real-time status updates without polling

## Option 1: Webhook-Based System

### Concept
Allow configurable webhooks that can be registered for different events.

### Implementation

```python
# New webhook model in schemas.py
class WebhookEvent(str, enum.Enum):
    JOB_STARTED = "job.started"
    JOB_PROGRESS = "job.progress"
    JOB_COMPLETED = "job.completed"
    JOB_FAILED = "job.failed"
    EMBEDDING_STARTED = "embedding.started"
    EMBEDDING_COMPLETED = "embedding.completed"
    WORKFLOW_STEP_COMPLETED = "workflow.step_completed"

class Webhook(Base):
    __tablename__ = "webhooks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(String, nullable=False)
    events = Column(JSON, nullable=False)  # List of WebhookEvent values
    headers = Column(JSON)  # Optional custom headers
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
```

### Usage in AI Worker

```python
# In worker.py
async def trigger_webhooks(event: str, payload: dict):
    """Trigger all registered webhooks for an event"""
    webhooks = await get_webhooks_for_event(event)
    
    for webhook in webhooks:
        asyncio.create_task(
            send_webhook(webhook.url, payload, webhook.headers)
        )

async def process_embedding_job(request_id: int):
    # Trigger start webhook
    await trigger_webhooks("embedding.started", {
        "request_id": request_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # ... process embedding ...
    
    # Trigger completion webhook
    await trigger_webhooks("embedding.completed", {
        "request_id": request_id,
        "embedding_id": embedding_id,
        "timestamp": datetime.utcnow().isoformat()
    })
```

## Option 2: Server-Sent Events (SSE) for UI Updates

### Concept
API streams real-time updates to the UI without polling.

### Implementation

```python
# New SSE endpoint in requests.py
@router.get("/{request_id}/events")
async def request_events(
    request_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Stream real-time updates for a request"""
    async def event_generator():
        last_status = None
        last_embedding_status = None
        
        while True:
            # Check for status changes
            request = await get_request(request_id, db)
            
            if request.status != last_status:
                yield f"event: status_change\ndata: {json.dumps({'status': request.status})}\n\n"
                last_status = request.status
            
            if request.embedding_status != last_embedding_status:
                yield f"event: embedding_status\ndata: {json.dumps({'embedding_status': request.embedding_status})}\n\n"
                last_embedding_status = request.embedding_status
            
            # Send heartbeat
            yield f"event: heartbeat\ndata: {json.dumps({'timestamp': datetime.utcnow().isoformat()})}\n\n"
            
            await asyncio.sleep(1)  # Check every second
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

### Frontend Usage

```javascript
// In the UI
const eventSource = new EventSource(`/api/requests/${requestId}/events`);

eventSource.addEventListener('status_change', (e) => {
    const data = JSON.parse(e.data);
    updateRequestStatus(data.status);
});

eventSource.addEventListener('embedding_status', (e) => {
    const data = JSON.parse(e.data);
    updateEmbeddingStatus(data.embedding_status);
});
```

## Option 3: Message Queue Based System

### Concept
Use Redis Pub/Sub or similar for decoupled communication.

### Implementation

```python
# New redis_events.py service
import redis.asyncio as redis
from typing import AsyncGenerator

class EventBus:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        self.pubsub = self.redis.pubsub()
    
    async def publish(self, channel: str, message: dict):
        """Publish event to a channel"""
        await self.redis.publish(
            channel, 
            json.dumps(message)
        )
    
    async def subscribe(self, pattern: str) -> AsyncGenerator:
        """Subscribe to channels matching pattern"""
        await self.pubsub.psubscribe(pattern)
        
        async for message in self.pubsub.listen():
            if message['type'] == 'pmessage':
                yield {
                    'channel': message['channel'].decode(),
                    'data': json.loads(message['data'])
                }

# In AI worker
event_bus = EventBus(settings.redis_url)

async def process_embedding_job(request_id: int):
    # Publish progress events
    await event_bus.publish(
        f"request.{request_id}.embedding",
        {
            "status": "processing",
            "progress": 0.5,
            "message": "Generating embeddings..."
        }
    )
```

## Option 4: WebSocket for Bidirectional Communication

### Concept
Full duplex communication between UI and API.

### Implementation

```python
# New websocket endpoint
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, request_id: int):
        await websocket.accept()
        if request_id not in self.active_connections:
            self.active_connections[request_id] = set()
        self.active_connections[request_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, request_id: int):
        self.active_connections[request_id].discard(websocket)
        if not self.active_connections[request_id]:
            del self.active_connections[request_id]
    
    async def broadcast_to_request(self, request_id: int, message: dict):
        if request_id in self.active_connections:
            for connection in self.active_connections[request_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/{request_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    request_id: int
):
    await manager.connect(websocket, request_id)
    try:
        while True:
            # Keep connection alive and handle client messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, request_id)

# In internal API endpoints
@router.post("/internal/notify-progress")
async def notify_progress(
    request_id: int,
    progress: dict
):
    """Called by AI worker to broadcast progress"""
    await manager.broadcast_to_request(request_id, progress)
    return {"status": "notified"}
```

## Option 5: Plugin-Based Hook System

### Concept
Allow users to register custom Python hooks that get called on events.

### Implementation

```python
# hooks/base.py
from abc import ABC, abstractmethod

class Hook(ABC):
    @abstractmethod
    async def on_job_started(self, job_id: str, request_id: int):
        pass
    
    @abstractmethod
    async def on_job_completed(self, job_id: str, request_id: int, result: dict):
        pass
    
    @abstractmethod
    async def on_job_failed(self, job_id: str, request_id: int, error: str):
        pass

# hooks/manager.py
class HookManager:
    def __init__(self):
        self.hooks: List[Hook] = []
    
    def register(self, hook: Hook):
        self.hooks.append(hook)
    
    async def trigger_job_started(self, job_id: str, request_id: int):
        for hook in self.hooks:
            try:
                await hook.on_job_started(job_id, request_id)
            except Exception as e:
                logger.error(f"Hook error: {e}")

# Example custom hook
class SlackNotificationHook(Hook):
    async def on_job_failed(self, job_id: str, request_id: int, error: str):
        await send_slack_message(
            f"Job {job_id} failed for request {request_id}: {error}"
        )
```

## Recommended Approach

For TaskFlow, I recommend a **hybrid approach**:

1. **SSE for UI → API communication** (Option 2)
   - Simple to implement
   - Works well for one-way updates
   - No additional infrastructure needed

2. **Configurable webhooks for extensibility** (Option 1)
   - Allows integration with external systems
   - Easy to add new event types

3. **Redis Pub/Sub for internal communication** (Option 3)
   - Decouples AI worker from API
   - Scales well with multiple workers
   - Can bridge to SSE/WebSocket for UI updates

### Example Integration

```python
# AI Worker publishes to Redis
await redis_client.publish(
    f"taskflow.request.{request_id}", 
    json.dumps({
        "event": "embedding.progress",
        "progress": 0.75,
        "message": "Storing in vector database..."
    })
)

# API subscribes and forwards to UI
async def redis_to_sse_bridge():
    async for message in event_bus.subscribe("taskflow.request.*"):
        request_id = extract_request_id(message['channel'])
        
        # Forward to SSE clients
        await sse_manager.send_event(request_id, message['data'])
        
        # Trigger webhooks
        await trigger_webhooks(message['data']['event'], message['data'])
```

This gives you:
- Real-time UI updates without polling
- Extensibility through webhooks
- Scalable internal communication
- No tight coupling between components