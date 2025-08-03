from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, HttpUrl, Field
from enum import Enum

class WebhookEventType(str, Enum):
    """Supported webhook event types"""
    # Job events
    JOB_STARTED = "job.started"
    JOB_COMPLETED = "job.completed"
    JOB_FAILED = "job.failed"
    JOB_PROGRESS = "job.progress"
    
    # Request events
    REQUEST_CREATED = "request.created"
    REQUEST_UPDATED = "request.updated"
    REQUEST_COMPLETED = "request.completed"
    
    # Embedding events
    EMBEDDING_STARTED = "embedding.started"
    EMBEDDING_COMPLETED = "embedding.completed"
    EMBEDDING_FAILED = "embedding.failed"

class WebhookDeliveryStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"

class WebhookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: HttpUrl
    description: Optional[str] = None
    events: List[WebhookEventType] = Field(..., min_items=1)
    headers: Optional[Dict[str, str]] = {}
    is_active: bool = True
    secret_token: Optional[str] = Field(None, max_length=255)
    retry_count: int = Field(3, ge=0, le=10)
    timeout_seconds: int = Field(30, ge=5, le=300)

class WebhookUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[HttpUrl] = None
    description: Optional[str] = None
    events: Optional[List[WebhookEventType]] = Field(None, min_items=1)
    headers: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None
    secret_token: Optional[str] = Field(None, max_length=255)
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    timeout_seconds: Optional[int] = Field(None, ge=5, le=300)

class WebhookResponse(BaseModel):
    id: int
    name: str
    url: str
    description: Optional[str]
    events: List[str]
    headers: Dict[str, str]
    is_active: bool
    secret_token: Optional[str]
    retry_count: int
    timeout_seconds: int
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class WebhookDeliveryResponse(BaseModel):
    id: int
    webhook_id: int
    event_type: str
    event_data: Dict[str, Any]
    status: WebhookDeliveryStatus
    attempts: int
    response_status: Optional[int]
    response_body: Optional[str]
    error_message: Optional[str]
    delivered_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class WebhookListResponse(BaseModel):
    webhooks: List[WebhookResponse]
    total: int

class WebhookDeliveryListResponse(BaseModel):
    deliveries: List[WebhookDeliveryResponse]
    total: int
    page: int
    page_size: int

class WebhookTestRequest(BaseModel):
    """Request to test a webhook with sample data"""
    event_type: WebhookEventType
    sample_data: Optional[Dict[str, Any]] = None

class WebhookTestResponse(BaseModel):
    """Response from webhook test"""
    success: bool
    status_code: Optional[int]
    response_body: Optional[str]
    error_message: Optional[str]
    duration_ms: float