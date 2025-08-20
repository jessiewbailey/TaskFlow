from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user
from app.models.database import get_db
from app.models.schemas import User, Webhook, WebhookDelivery
from app.models.webhook_models import (
    WebhookCreate,
    WebhookDeliveryListResponse,
    WebhookDeliveryResponse,
    WebhookListResponse,
    WebhookResponse,
    WebhookTestRequest,
    WebhookTestResponse,
    WebhookUpdate,
)
from app.services.webhook_service import WebhookService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.get("", response_model=WebhookListResponse)
async def list_webhooks(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all webhooks"""
    query = select(Webhook)

    # Apply filters
    if is_active is not None:
        query = query.where(Webhook.is_active == is_active)
    if event_type:
        query = query.where(Webhook.events.contains([event_type]))

    # Only admins can see all webhooks
    if current_user.role != "ADMIN":
        query = query.where(Webhook.created_by == current_user.id)

    result = await db.execute(query.order_by(Webhook.created_at.desc()))
    webhooks = result.scalars().all()

    return WebhookListResponse(
        webhooks=[WebhookResponse.from_orm(w) for w in webhooks], total=len(webhooks)
    )


@router.post("", response_model=WebhookResponse)
async def create_webhook(
    webhook_data: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new webhook"""
    # Check if name already exists
    existing = await db.execute(select(Webhook).where(Webhook.name == webhook_data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Webhook name already exists")

    webhook = Webhook(**webhook_data.dict(), created_by=current_user.id)

    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)

    logger.info(f"Created webhook {webhook.id} for user {current_user.id}")

    return WebhookResponse.from_orm(webhook)


@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific webhook"""
    query = select(Webhook).where(Webhook.id == webhook_id)

    # Only admins can see all webhooks
    if current_user.role != "ADMIN":
        query = query.where(Webhook.created_by == current_user.id)

    result = await db.execute(query)
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    return WebhookResponse.from_orm(webhook)


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: int,
    webhook_update: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a webhook"""
    query = select(Webhook).where(Webhook.id == webhook_id)

    # Only admins can update all webhooks
    if current_user.role != "ADMIN":
        query = query.where(Webhook.created_by == current_user.id)

    result = await db.execute(query)
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Check if new name already exists
    if webhook_update.name and webhook_update.name != webhook.name:
        existing = await db.execute(select(Webhook).where(Webhook.name == webhook_update.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Webhook name already exists")

    # Update webhook
    update_data = webhook_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(webhook, field, value)

    await db.commit()
    await db.refresh(webhook)

    logger.info(f"Updated webhook {webhook.id}")

    return WebhookResponse.from_orm(webhook)


@router.delete("/{webhook_id}")
async def delete_webhook(
    webhook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a webhook"""
    query = select(Webhook).where(Webhook.id == webhook_id)

    # Only admins can delete all webhooks
    if current_user.role != "ADMIN":
        query = query.where(Webhook.created_by == current_user.id)

    result = await db.execute(query)
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    await db.delete(webhook)
    await db.commit()

    logger.info(f"Deleted webhook {webhook_id}")

    return {"message": "Webhook deleted successfully"}


@router.post("/{webhook_id}/test", response_model=WebhookTestResponse)
async def test_webhook(
    webhook_id: int,
    test_request: WebhookTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test a webhook with sample data"""
    query = select(Webhook).where(Webhook.id == webhook_id)

    # Only admins can test all webhooks
    if current_user.role != "ADMIN":
        query = query.where(Webhook.created_by == current_user.id)

    result = await db.execute(query)
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Check if webhook is subscribed to this event
    if test_request.event_type not in webhook.events:
        raise HTTPException(
            status_code=400,
            detail=f"Webhook is not subscribed to {test_request.event_type} events",
        )

    service = WebhookService(db)
    result = await service.test_webhook(webhook, test_request.event_type, test_request.sample_data)

    return WebhookTestResponse(**result)


@router.get("/{webhook_id}/deliveries", response_model=WebhookDeliveryListResponse)
async def list_webhook_deliveries(
    webhook_id: int,
    status: Optional[str] = Query(None, description="Filter by delivery status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List delivery history for a webhook"""
    # First check if user has access to this webhook
    webhook_query = select(Webhook).where(Webhook.id == webhook_id)
    if current_user.role != "ADMIN":
        webhook_query = webhook_query.where(Webhook.created_by == current_user.id)

    webhook_result = await db.execute(webhook_query)
    webhook = webhook_result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    # Build delivery query
    query = select(WebhookDelivery).where(WebhookDelivery.webhook_id == webhook_id)

    if status:
        query = query.where(WebhookDelivery.status == status)

    # Count total
    count_query = select(func.count(WebhookDelivery.id)).where(
        WebhookDelivery.webhook_id == webhook_id
    )
    if status:
        count_query = count_query.where(WebhookDelivery.status == status)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(WebhookDelivery.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    deliveries = result.scalars().all()

    return WebhookDeliveryListResponse(
        deliveries=[WebhookDeliveryResponse.from_orm(d) for d in deliveries],
        total=total,
        page=page,
        page_size=page_size,
    )
