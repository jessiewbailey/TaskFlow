"""
Bridge service to connect Redis events to SSE clients
"""
import asyncio
from app.services.event_bus import event_bus, get_channel_pattern_for_all_requests
from app.services.sse_manager import sse_manager
import structlog

logger = structlog.get_logger()

class EventBridge:
    """Bridges Redis events to SSE clients"""
    
    def __init__(self):
        self._running = False
        self._task = None
    
    async def start(self):
        """Start the event bridge"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._bridge_events())
        logger.info("Event bridge started")
    
    async def stop(self):
        """Stop the event bridge"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Event bridge stopped")
    
    async def _bridge_events(self):
        """Subscribe to Redis events and forward to SSE clients"""
        try:
            async for message in event_bus.subscribe(get_channel_pattern_for_all_requests()):
                if not self._running:
                    break
                
                try:
                    # Extract request_id from channel name
                    # Channel format: taskflow.request.{request_id}
                    channel_parts = message['channel'].split('.')
                    if len(channel_parts) >= 3:
                        request_id = int(channel_parts[2])
                        event_data = message['data']
                        
                        # Forward to SSE clients
                        await sse_manager.broadcast_to_request(
                            request_id,
                            event_data.get('type', 'update'),
                            event_data
                        )
                        
                        logger.debug("Bridged event to SSE", 
                                   request_id=request_id,
                                   event_type=event_data.get('type'))
                        
                except (ValueError, IndexError) as e:
                    logger.error("Failed to parse channel", 
                               channel=message['channel'], 
                               error=str(e))
                except Exception as e:
                    logger.error("Failed to bridge event", 
                               error=str(e), 
                               message=message)
                    
        except asyncio.CancelledError:
            logger.info("Event bridge cancelled")
            raise
        except Exception as e:
            logger.error("Event bridge error", error=str(e))

# Global event bridge instance
event_bridge = EventBridge()