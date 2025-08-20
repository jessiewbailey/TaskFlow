import enum
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class UserRole(str, enum.Enum):
    ANALYST = "ANALYST"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"


class RequestStatus(str, enum.Enum):
    NEW = "NEW"
    IN_REVIEW = "IN_REVIEW"
    PENDING = "PENDING"
    CLOSED = "CLOSED"


class EmbeddingStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# Exercise Models
class ExerciseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    is_active: bool = True
    is_default: bool = False


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class Exercise(ExerciseBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# User Models
class User(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    created_at: datetime


# Request Models
class CreateRequestRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=50000)
    requester: Optional[str] = Field(None, max_length=256)
    assigned_analyst_id: Optional[int] = None
    workflow_id: Optional[int] = None
    exercise_id: Optional[int] = None


class UpdateRequestStatusRequest(BaseModel):
    status: RequestStatus
    assigned_analyst_id: Optional[int] = None


class UpdateRequestRequest(BaseModel):
    text: Optional[str] = Field(None, min_length=10, max_length=50000)
    requester: Optional[str] = Field(None, max_length=256)
    status: Optional[RequestStatus] = None
    assigned_analyst_id: Optional[int] = None
    workflow_id: Optional[int] = None
    exercise_id: Optional[int] = None
    due_date: Optional[str] = None  # ISO date string


class ProcessRequestRequest(BaseModel):
    instructions: Optional[str] = Field(None, max_length=2000)


class AssignWorkflowRequest(BaseModel):
    workflow_id: int
    reprocess: bool = False


# Response Models
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class AIOutputResponse(BaseModel):
    id: int
    version: int
    summary: Optional[str]  # JSON string containing all workflow outputs
    model_name: Optional[str]
    tokens_used: Optional[int]
    duration_ms: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
        protected_namespaces = ()


class JobProgressResponse(BaseModel):
    job_id: str
    request_id: int
    status: JobStatus
    error_message: Optional[str]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime


class RequestResponse(BaseModel):
    id: int
    text: str
    requester: Optional[str]
    date_received: date
    assigned_analyst_id: Optional[int]
    workflow_id: Optional[int] = None
    exercise_id: Optional[int] = None
    status: RequestStatus
    embedding_status: EmbeddingStatus = EmbeddingStatus.PENDING
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime
    assigned_analyst: Optional[UserResponse]
    exercise: Optional[Exercise] = None
    latest_ai_output: Optional[AIOutputResponse]
    has_active_jobs: Optional[bool] = False
    latest_failed_job: Optional[JobProgressResponse] = None
    queue_position: Optional[int] = None
    latest_job_id: Optional[str] = None

    class Config:
        from_attributes = True


class RequestListResponse(BaseModel):
    requests: List[RequestResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool = False  # For pagination


class CreateRequestResponse(BaseModel):
    id: int
    job_id: str


class ProcessJobResponse(BaseModel):
    job_id: str


# Batch Upload Models
class BatchUploadError(BaseModel):
    row: int
    message: str


class BatchUploadResponse(BaseModel):
    success: bool
    total_rows: int
    success_count: int
    errors: List[BatchUploadError]


# Bulk Rerun Models
class BulkRerunRequest(BaseModel):
    workflow_id: int


class BulkRerunError(BaseModel):
    task_id: int
    message: str


class BulkRerunResponse(BaseModel):
    success: bool
    total_tasks: int
    success_count: int
    errors: List[BulkRerunError]


# AI Pipeline Models
class BasicMetadata(BaseModel):
    word_count: int
    estimated_processing_time: int
    document_type: str
    urgency_level: str


class TopicClassification(BaseModel):
    primary_topic: str
    secondary_topics: List[str]
    confidence_score: float


class RequestSummary(BaseModel):
    executive_summary: str
    key_points: List[str]
    requested_records: List[str]


class SensitivityAssessment(BaseModel):
    score: float
    risk_factors: List[str]
    explanation: str


class RedactionSuggestion(BaseModel):
    text_span: str
    start_pos: int
    end_pos: int
    reason: str
    exemption_code: str
    confidence: float


class AIProcessingResult(BaseModel):
    basic_metadata: BasicMetadata
    topic_classification: TopicClassification
    summary: RequestSummary
    sensitivity_assessment: SensitivityAssessment
    redaction_suggestions: List[RedactionSuggestion]


# Workflow Models
class WorkflowBlockInputRequest(BaseModel):
    input_type: str  # "REQUEST_TEXT" or "BLOCK_OUTPUT"
    source_block_id: Optional[int] = None
    variable_name: str = Field(..., min_length=1, max_length=64)


class WorkflowBlockRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    prompt: str = Field(..., min_length=1)
    system_prompt: Optional[str] = None
    order: int = Field(..., ge=0)
    block_type: str = "CUSTOM"  # "CORE" or "CUSTOM"
    output_schema: Optional[Dict[str, Any]] = None
    model_name: Optional[str] = Field(None, max_length=128)
    model_parameters: Optional[Dict[str, Any]] = None
    inputs: List[WorkflowBlockInputRequest] = []

    class Config:
        protected_namespaces = ()


class CreateWorkflowRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    is_default: bool = False
    blocks: List[WorkflowBlockRequest] = []


class UpdateWorkflowRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    description: Optional[str] = None
    status: Optional[str] = None
    is_default: Optional[bool] = None
    blocks: Optional[List[WorkflowBlockRequest]] = None


class WorkflowBlockInputResponse(BaseModel):
    id: int
    input_type: str
    source_block_id: Optional[int]
    variable_name: str

    class Config:
        from_attributes = True


class WorkflowBlockResponse(BaseModel):
    id: int
    workflow_id: int
    name: str
    prompt: str
    system_prompt: Optional[str]
    order: int
    block_type: str
    output_schema: Optional[Dict[str, Any]]
    model_name: Optional[str]
    model_parameters: Optional[Dict[str, Any]]
    inputs: List[WorkflowBlockInputResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        protected_namespaces = ()


class WorkflowResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    is_default: bool
    created_by: int
    blocks: List[WorkflowBlockResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    workflows: List[WorkflowResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# Dashboard Configuration Models
class DashboardFieldConfigRequest(BaseModel):
    id: str
    block_name: str
    field_path: str
    display_type: str  # 'text', 'progress_bar', 'badge', 'list', 'card', 'json'
    label: str
    order: int
    width: str  # 'full', 'half', 'third', 'quarter'
    visible: bool


class DashboardConfigRequest(BaseModel):
    workflow_id: int
    fields: List[DashboardFieldConfigRequest]
    layout: str  # 'grid', 'list'


class DashboardConfigResponse(BaseModel):
    id: int
    workflow_id: int
    fields: List[Dict[str, Any]]
    layout: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Custom Instructions Models
class CustomInstructionRequest(BaseModel):
    workflow_block_id: int
    instruction_text: str = Field(..., min_length=1, max_length=5000)


class CustomInstructionResponse(BaseModel):
    id: int
    request_id: int
    workflow_block_id: int
    instruction_text: str
    created_by: Optional[int]
    created_at: datetime
    updated_at: datetime
    is_active: bool

    # Related data
    workflow_block_name: Optional[str] = None

    class Config:
        from_attributes = True


class CustomInstructionUpdateRequest(BaseModel):
    instruction_text: Optional[str] = Field(None, min_length=1, max_length=5000)
    is_active: Optional[bool] = None


# Ground Truth Models
class CreateGroundTruthRequest(BaseModel):
    request_id: int
    workflow_block_id: int
    field_path: str = Field(..., min_length=1, max_length=255)
    ai_value: Any = None
    ground_truth_value: Any
    notes: Optional[str] = None


class UpdateGroundTruthRequest(BaseModel):
    ground_truth_value: Optional[Any] = None
    notes: Optional[str] = None


class GroundTruthResponse(BaseModel):
    id: int
    request_id: int
    workflow_block_id: int
    field_path: str
    ai_value: Optional[Any]
    ground_truth_value: Any
    created_by: int
    created_at: datetime
    updated_at: datetime
    notes: Optional[str]

    # Related data
    workflow_block_name: Optional[str] = None
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# User Preferences Models
class UpdateUserPreferencesRequest(BaseModel):
    fine_tuning_mode: Optional[bool] = None
    # Add other preferences as needed


class UserPreferencesResponse(BaseModel):
    fine_tuning_mode: bool = False
    # Add other preferences as needed


# System Settings Models
class SystemSettingResponse(BaseModel):
    id: int
    key: str
    value: Any
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UpdateSystemSettingRequest(BaseModel):
    value: Any


# RAG Search Models
class RAGSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=5, ge=1, le=20)
    filters: Optional[Dict[str, Any]] = None
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    include_scores: bool = True


class RAGSearchResult(BaseModel):
    task_id: int
    similarity_score: float
    # Make other fields optional to support custom display
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    created_at: Optional[datetime] = None
    exercise_id: Optional[int] = None

    class Config:
        extra = "allow"  # Allow additional fields from custom display config


class RAGSearchResponse(BaseModel):
    results: List[RAGSearchResult]
    query: str
    total_results: int


# Workflow Embedding Configuration Models
class WorkflowEmbeddingConfigCreate(BaseModel):
    enabled: bool = True
    embedding_template: str = Field(..., min_length=1, max_length=5000)


class WorkflowEmbeddingConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    embedding_template: Optional[str] = Field(None, min_length=1, max_length=5000)


class WorkflowEmbeddingConfigResponse(BaseModel):
    id: int
    workflow_id: int
    enabled: bool
    embedding_template: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Workflow Similarity Configuration Models
class SimilarityDisplayField(BaseModel):
    name: str
    type: str  # text, number, list, date, etc.
    source: str  # Block_Name.field_path
    display_options: Optional[Dict[str, Any]] = None  # formatting options


class WorkflowSimilarityConfigCreate(BaseModel):
    fields: List[SimilarityDisplayField]


class WorkflowSimilarityConfigUpdate(BaseModel):
    fields: Optional[List[SimilarityDisplayField]] = None


class WorkflowSimilarityConfigResponse(BaseModel):
    id: int
    workflow_id: int
    fields: List[SimilarityDisplayField]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
