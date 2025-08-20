"""
Server-Sent Events (SSE) manager for real-time client updates
"""

import asyncio
import json
from typing import AsyncGenerator, Dict, Set

import structlog

logger = structlog.get_logger()


class SSEClient:
    """Represents a connected SSE client"""

    def __init__(self, request_id: int):
        self.request_id = request_id
        self.queue: asyncio.Queue = asyncio.Queue()

    async def send_event(self, event_type: str, data: Dict):
        """Queue an event for this client"""
        await self.queue.put({"type": event_type, "data": data})


class SSEManager:
    """Manages SSE connections and event distribution"""

    def __init__(self):
        # Map of request_id to set of connected clients
        self._clients: Dict[int, Set[SSEClient]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, request_id: int) -> SSEClient:
        """Register a new SSE client for a request"""
        client = SSEClient(request_id)

        async with self._lock:
            if request_id not in self._clients:
                self._clients[request_id] = set()
            self._clients[request_id].add(client)

        logger.info(
            "SSE client connected",
            request_id=request_id,
            total_clients=len(self._clients[request_id]),
        )

        # Send initial connection event
        await client.send_event("connected", {"request_id": request_id})

        return client

    async def disconnect(self, request_id: int, client: SSEClient):
        """Remove a client connection"""
        async with self._lock:
            if request_id in self._clients:
                self._clients[request_id].discard(client)
                if not self._clients[request_id]:
                    del self._clients[request_id]

        logger.info("SSE client disconnected", request_id=request_id)

    async def broadcast_to_request(self, request_id: int, event_type: str, data: Dict):
        """Broadcast an event to all clients watching a specific request"""
        async with self._lock:
            clients = self._clients.get(request_id, set()).copy()

        if clients:
            logger.debug(
                "Broadcasting event to clients",
                request_id=request_id,
                event_type=event_type,
                client_count=len(clients),
            )

            # Send to all clients concurrently
            tasks = [client.send_event(event_type, data) for client in clients]
            await asyncio.gather(*tasks, return_exceptions=True)

    async def generate_events(self, client: SSEClient) -> AsyncGenerator[str, None]:
        """Generate SSE formatted events for a client"""
        try:
            while True:
                # Wait for events with timeout for keepalive
                try:
                    event = await asyncio.wait_for(client.queue.get(), timeout=30.0)

                    # Format as SSE
                    if event["type"] == "keepalive":
                        yield ": keepalive\\n\\n"
                    else:
                        yield f"event: {event['type']}\\n"
                        yield f"data: {json.dumps(event['data'])}\\n\\n"

                except asyncio.TimeoutError:
                    # Send keepalive
                    yield ": keepalive\\n\\n"

        except asyncio.CancelledError:
            # Client disconnected
            raise
        except Exception as e:
            logger.error("Error generating SSE events", error=str(e))
            raise


# Global SSE manager instance
sse_manager = SSEManager()


def create_sse_response(generator: AsyncGenerator[str, None]):
    """Create a FastAPI SSE response"""
    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
