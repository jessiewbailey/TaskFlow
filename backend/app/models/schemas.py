from sqlalchemy import Column, BigInteger, String, Text, Date, Enum, TIMESTAMP, Integer, DECIMAL, JSON, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.database import Base
import enum
import uuid

class UserRole(str, enum.Enum):
    ANALYST = "ANALYST"
    SUPERVISOR = "SUPERVISOR"
    ADMIN = "ADMIN"

class RequestStatus(str, enum.Enum):
    NEW = "NEW"
    IN_REVIEW = "IN_REVIEW"
    PENDING = "PENDING"
    CLOSED = "CLOSED"

class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class JobType(str, enum.Enum):
    STANDARD = "STANDARD"
    CUSTOM = "CUSTOM"
    WORKFLOW = "WORKFLOW"

class WorkflowStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"

class BlockInputType(str, enum.Enum):
    REQUEST_TEXT = "REQUEST_TEXT"
    BLOCK_OUTPUT = "BLOCK_OUTPUT"

class BlockType(str, enum.Enum):
    CORE = "CORE"
    CUSTOM = "CUSTOM"

class DashboardLayout(str, enum.Enum):
    grid = "grid"
    list = "list"

class Exercise(Base):
    __tablename__ = "exercises"
    
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    requests = relationship("Request", back_populates="exercise")
    permissions = relationship("ExercisePermission", back_populates="exercise")

class ExercisePermission(Base):
    __tablename__ = "exercise_permissions"
    
    id = Column(BigInteger, primary_key=True, index=True)
    exercise_id = Column(BigInteger, ForeignKey("exercises.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    permission_level = Column(String(32), nullable=False, default="read")
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    exercise = relationship("Exercise", back_populates="permissions")
    user = relationship("User", back_populates="exercise_permissions")

class User(Base):
    __tablename__ = "users"
    
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    email = Column(String(256), unique=True, nullable=False, index=True)
    role = Column(Enum(UserRole, name='user_role'), nullable=False)
    preferences = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    assigned_requests = relationship("Request", back_populates="assigned_analyst")
    ground_truth_entries = relationship("GroundTruthData", back_populates="creator")
    exercise_permissions = relationship("ExercisePermission", back_populates="user")

class Request(Base):
    __tablename__ = "requests"
    
    id = Column(BigInteger, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    requester = Column(String(256), nullable=True)
    date_received = Column(Date, server_default=func.current_date())
    assigned_analyst_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    workflow_id = Column(BigInteger, ForeignKey("workflows.id"), nullable=True)
    exercise_id = Column(BigInteger, ForeignKey("exercises.id"), nullable=True)
    status = Column(Enum(RequestStatus, name='request_status'), default=RequestStatus.NEW)
    due_date = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    assigned_analyst = relationship("User", back_populates="assigned_requests")
    workflow = relationship("Workflow")
    exercise = relationship("Exercise", back_populates="requests")
    ai_outputs = relationship("AIOutput", back_populates="request", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="request", cascade="all, delete-orphan")
    custom_instructions = relationship("CustomInstruction", back_populates="request", cascade="all, delete-orphan")

class AIOutput(Base):
    __tablename__ = "ai_outputs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    request_id = Column(BigInteger, ForeignKey("requests.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    summary = Column(Text, nullable=True)
    topic = Column(String(128), nullable=True)
    sensitivity_score = Column(DECIMAL(3, 2), nullable=True)
    redactions_json = Column(JSON, nullable=True)
    custom_instructions = Column(Text, nullable=True)
    model_name = Column(String(64), nullable=True)
    tokens_used = Column(Integer, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    request = relationship("Request", back_populates="ai_outputs")

class ProcessingJob(Base):
    __tablename__ = "processing_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id = Column(BigInteger, ForeignKey("requests.id"), nullable=False)
    workflow_id = Column(BigInteger, ForeignKey("workflows.id"), nullable=True)
    status = Column(Enum(JobStatus, name='job_status'), default=JobStatus.PENDING)
    job_type = Column(Enum(JobType, name='job_type'), default=JobType.STANDARD)
    custom_instructions = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(TIMESTAMP, nullable=True)
    completed_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    request = relationship("Request", back_populates="processing_jobs")
    workflow = relationship("Workflow")

class Workflow(Base):
    __tablename__ = "workflows"
    
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(WorkflowStatus, name='workflow_status'), default=WorkflowStatus.DRAFT)
    is_default = Column(Boolean, default=False, nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    creator = relationship("User")
    blocks = relationship("WorkflowBlock", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowBlock.order")
    dashboard_config = relationship("WorkflowDashboardConfig", uselist=False, cascade="all, delete-orphan")

class WorkflowBlock(Base):
    __tablename__ = "workflow_blocks"
    
    id = Column(BigInteger, primary_key=True, index=True)
    workflow_id = Column(BigInteger, ForeignKey("workflows.id"), nullable=False)
    name = Column(String(128), nullable=False)
    prompt = Column(Text, nullable=False)
    order = Column('order_index', Integer, nullable=False)
    block_type = Column(Enum(BlockType, name='block_type'), default=BlockType.CUSTOM, nullable=False)
    output_schema = Column(JSON, nullable=True)  # Pydantic schema as JSON
    model_name = Column(String(128), nullable=True)  # AI model to use for this block
    model_parameters = Column(JSON, nullable=True)  # Model-specific parameters (temperature, max_tokens, etc.)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    workflow = relationship("Workflow", back_populates="blocks")
    inputs = relationship("WorkflowBlockInput", back_populates="block", cascade="all, delete-orphan", foreign_keys="WorkflowBlockInput.block_id")

class WorkflowBlockInput(Base):
    __tablename__ = "workflow_block_inputs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    block_id = Column(BigInteger, ForeignKey("workflow_blocks.id"), nullable=False)
    input_type = Column(Enum(BlockInputType, name='block_input_type'), nullable=False)
    source_block_id = Column(BigInteger, ForeignKey("workflow_blocks.id"), nullable=True)  # Only for BLOCK_OUTPUT type
    variable_name = Column(String(64), nullable=False)  # Name to use in prompt template
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    
    # Relationships
    block = relationship("WorkflowBlock", back_populates="inputs", foreign_keys=[block_id])
    source_block = relationship("WorkflowBlock", foreign_keys=[source_block_id], post_update=True)

class WorkflowDashboardConfig(Base):
    __tablename__ = "workflow_dashboard_configs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    workflow_id = Column(BigInteger, ForeignKey("workflows.id"), nullable=False)
    fields = Column(JSON, nullable=False)
    layout = Column(Enum(DashboardLayout, name='dashboard_layout'), default=DashboardLayout.grid)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    workflow = relationship("Workflow")

class CustomInstruction(Base):
    __tablename__ = "custom_instructions"
    
    id = Column(BigInteger, primary_key=True, index=True)
    request_id = Column(BigInteger, ForeignKey("requests.id"), nullable=False)
    workflow_block_id = Column(BigInteger, ForeignKey("workflow_blocks.id"), nullable=False)
    instruction_text = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, default=1)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    request = relationship("Request", back_populates="custom_instructions")
    workflow_block = relationship("WorkflowBlock")
    creator = relationship("User")

class GroundTruthData(Base):
    __tablename__ = "ground_truth_data"
    
    id = Column(BigInteger, primary_key=True, index=True)
    request_id = Column(BigInteger, ForeignKey("requests.id"), nullable=False)
    workflow_block_id = Column(BigInteger, ForeignKey("workflow_blocks.id"), nullable=False)
    field_path = Column(String(255), nullable=False)
    ai_value = Column(JSON, nullable=True)
    ground_truth_value = Column(JSON, nullable=False)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    notes = Column(Text, nullable=True)
    
    # Relationships
    request = relationship("Request")
    workflow_block = relationship("WorkflowBlock")
    creator = relationship("User", back_populates="ground_truth_entries")

class SystemSettings(Base):
    __tablename__ = "system_settings"
    
    id = Column(BigInteger, primary_key=True, index=True)
    key = Column(String(128), nullable=False, unique=True)
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    updated_at = Column(TIMESTAMP, server_default=func.current_timestamp(), onupdate=func.current_timestamp())