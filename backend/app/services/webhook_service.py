import asyncio
import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Dict, Optional

import httpx
import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import Webhook, WebhookDelivery
from app.models.webhook_models import WebhookDeliveryStatus

logger = structlog.get_logger()


class WebhookService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def trigger_webhooks(self, event_type: str, event_data: Dict[str, Any]):
        """Trigger all active webhooks subscribed to the given event type"""
        # Find all active webhooks subscribed to this event
        result = await self.db.execute(
            select(Webhook)
            .where(Webhook.is_active)
            .where(Webhook.events.contains([event_type]))
        )
        webhooks = result.scalars().all()

        # Create delivery records and trigger deliveries asynchronously
        delivery_tasks = []
        for webhook in webhooks:
            delivery = WebhookDelivery(
                webhook_id=webhook.id,
                event_type=event_type,
                event_data=event_data,
                status=WebhookDeliveryStatus.PENDING,
            )
            self.db.add(delivery)
            await self.db.commit()

            # Update last_triggered_at
            await self.db.execute(
                update(Webhook)
                .where(Webhook.id == webhook.id)
                .values(last_triggered_at=datetime.utcnow())
            )
            await self.db.commit()

            # Create async task for delivery
            task = asyncio.create_task(self._deliver_webhook(webhook, delivery))
            delivery_tasks.append(task)

        # Don't wait for deliveries to complete
        logger.info(f"Triggered {len(delivery_tasks)} webhooks for event {event_type}")

    async def _deliver_webhook(self, webhook: Webhook, delivery: WebhookDelivery):
        """Deliver a webhook with retry logic"""
        for attempt in range(webhook.retry_count + 1):
            try:
                delivery.attempts = attempt + 1

                # Prepare headers
                headers = webhook.headers.copy() if webhook.headers else {}
                headers["Content-Type"] = "application/json"
                headers["X-TaskFlow-Event"] = delivery.event_type
                headers["X-TaskFlow-Delivery-ID"] = str(delivery.id)

                # Add signature if secret token is configured
                if webhook.secret_token:
                    payload_bytes = json.dumps(delivery.event_data).encode()
                    signature = hmac.new(
                        webhook.secret_token.encode(), payload_bytes, hashlib.sha256
                    ).hexdigest()
                    headers["X-TaskFlow-Signature"] = f"sha256={signature}"

                # Send the webhook
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        webhook.url,
                        json=delivery.event_data,
                        headers=headers,
                        timeout=webhook.timeout_seconds,
                    )

                    delivery.response_status = response.status_code
                    delivery.response_body = response.text[
                        :1000
                    ]  # Limit stored response size

                    if response.is_success:
                        delivery.status = WebhookDeliveryStatus.SUCCESS
                        delivery.delivered_at = datetime.utcnow()

                        # Update delivery in database
                        await self._update_delivery(delivery)

                        logger.info(
                            f"Successfully delivered webhook {webhook.id} "
                            f"for event {delivery.event_type}"
                        )
                        return
                    else:
                        delivery.error_message = (
                            f"HTTP {response.status_code}: {response.text[:500]}"
                        )

            except Exception as e:
                delivery.error_message = str(e)
                logger.error(f"Error delivering webhook {webhook.id}: {str(e)}")

            # If not the last attempt, wait before retrying
            if attempt < webhook.retry_count:
                wait_time = min(2**attempt, 60)  # Exponential backoff, max 60 seconds
                await asyncio.sleep(wait_time)

        # All attempts failed
        delivery.status = WebhookDeliveryStatus.FAILED
        await self._update_delivery(delivery)
        logger.error(
            f"Failed to deliver webhook {webhook.id} after {webhook.retry_count + 1} attempts"
        )

    async def _update_delivery(self, delivery: WebhookDelivery):
        """Update delivery record in database"""
        from app.models.database import get_db_session

        async with get_db_session() as db:
            await db.execute(
                update(WebhookDelivery)
                .where(WebhookDelivery.id == delivery.id)
                .values(
                    status=delivery.status,
                    attempts=delivery.attempts,
                    response_status=delivery.response_status,
                    response_body=delivery.response_body,
                    error_message=delivery.error_message,
                    delivered_at=delivery.delivered_at,
                )
            )
            await db.commit()

    async def test_webhook(
        self,
        webhook: Webhook,
        event_type: str,
        sample_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Test a webhook with sample data"""
        import time

        # Use sample data or generate default
        if sample_data is None:
            sample_data = {
                "event": event_type,
                "timestamp": datetime.utcnow().isoformat(),
                "test": True,
                "request_id": 12345,
                "message": f"This is a test webhook for {event_type}",
            }

        # Prepare headers
        headers = webhook.headers.copy() if webhook.headers else {}
        headers["Content-Type"] = "application/json"
        headers["X-TaskFlow-Event"] = event_type
        headers["X-TaskFlow-Test"] = "true"

        # Add signature if secret token is configured
        if webhook.secret_token:
            payload_bytes = json.dumps(sample_data).encode()
            signature = hmac.new(
                webhook.secret_token.encode(), payload_bytes, hashlib.sha256
            ).hexdigest()
            headers["X-TaskFlow-Signature"] = f"sha256={signature}"

        start_time = time.time()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    webhook.url,
                    json=sample_data,
                    headers=headers,
                    timeout=webhook.timeout_seconds,
                )

                duration_ms = (time.time() - start_time) * 1000

                return {
                    "success": response.is_success,
                    "status_code": response.status_code,
                    "response_body": response.text[:1000],
                    "error_message": (
                        None if response.is_success else f"HTTP {response.status_code}"
                    ),
                    "duration_ms": duration_ms,
                }

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return {
                "success": False,
                "status_code": None,
                "response_body": None,
                "error_message": str(e),
                "duration_ms": duration_ms,
            }


# Global webhook service instance
webhook_service = None


async def get_webhook_service(db: AsyncSession) -> WebhookService:
    """Get or create webhook service instance"""
    global webhook_service
    if webhook_service is None:
        webhook_service = WebhookService(db)
    return webhook_service
