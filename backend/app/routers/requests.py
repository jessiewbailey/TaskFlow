from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List, Dict, Any
import pandas as pd
import io
from datetime import datetime
from app.models.database import get_db
from app.models.schemas import Request, User, AIOutput, RequestStatus, Workflow, JobType, CustomInstruction, ProcessingJob, JobStatus, Exercise as ExerciseModel
from app.models.pydantic_models import (
    CreateRequestRequest, CreateRequestResponse, UpdateRequestStatusRequest,
    UpdateRequestRequest, ProcessRequestRequest, ProcessJobResponse, RequestResponse, 
    RequestListResponse, UserResponse, AIOutputResponse, AssignWorkflowRequest,
    BatchUploadResponse, BatchUploadError, BulkRerunRequest, BulkRerunResponse, BulkRerunError,
    Exercise
)
from pydantic import BaseModel
from app.services.job_service import JobService
from app.services.embedding_service import embedding_service
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/requests", tags=["requests"])

# Additional models for similarity search
class SimilaritySearchRequest(BaseModel):
    query: Optional[str] = None
    limit: int = 5
    threshold: float = 0.0
    restrict_to_exercise: bool = False
    filters: Optional[Dict[str, Any]] = None

class SimilarTask(BaseModel):
    score: float
    task_id: int
    title: str
    description: str
    priority: str
    status: str
    tags: List[str]
    exercise_id: Optional[int]
    created_at: str

class SimilaritySearchResponse(BaseModel):
    similar_tasks: List[SimilarTask]

@router.get("", response_model=RequestListResponse)
async def list_requests(
    analyst: Optional[int] = Query(None, description="Filter by analyst ID"),
    status: Optional[RequestStatus] = Query(None, description="Filter by status"),
    exercise_id: Optional[int] = Query(None, description="Filter by exercise ID"),
    sort_by: str = Query("created_at", description="Sort field"),
    order: str = Query("desc", description="Sort order (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db)
):
    """List and filter requests with pagination"""
    
    # Build query
    query = select(Request).options(
        selectinload(Request.assigned_analyst),
        selectinload(Request.ai_outputs),
        selectinload(Request.exercise)
    )
    
    # Apply filters
    conditions = []
    if analyst is not None:
        conditions.append(Request.assigned_analyst_id == analyst)
    if status is not None:
        conditions.append(Request.status == status)
    if exercise_id is not None:
        conditions.append(Request.exercise_id == exercise_id)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Apply sorting
    sort_column = getattr(Request, sort_by, Request.created_at)
    if order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    # Get total count
    count_query = select(func.count(Request.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    
    # Execute query
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # Get all request IDs to check for active jobs
    request_ids = [req.id for req in requests]
    
    # Check for active jobs (PENDING or RUNNING) for all requests in one query
    active_job_request_ids = set()
    if request_ids:  # Only query if there are requests
        active_jobs_result = await db.execute(
            select(ProcessingJob.request_id)
            .where(ProcessingJob.request_id.in_(request_ids))
            .where(ProcessingJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING]))
        )
        active_job_request_ids = set(active_jobs_result.scalars().all())
    
    # Convert to response format
    request_responses = []
    for req in requests:
        # Get latest AI output
        latest_ai_output = None
        if req.ai_outputs:
            latest_ai_output = max(req.ai_outputs, key=lambda x: x.version)
        
        # Check if this request has active jobs
        has_active_jobs = req.id in active_job_request_ids
        
        request_responses.append(
            RequestResponse(
                id=req.id,
                text=req.text,
                requester=req.requester,
                date_received=req.date_received,
                assigned_analyst_id=req.assigned_analyst_id,
                workflow_id=req.workflow_id,
                exercise_id=req.exercise_id,
                status=req.status,
                due_date=req.due_date,
                created_at=req.created_at,
                updated_at=req.updated_at,
                assigned_analyst=UserResponse.from_orm(req.assigned_analyst) if req.assigned_analyst else None,
                exercise=Exercise.from_orm(req.exercise) if req.exercise else None,
                latest_ai_output=AIOutputResponse.from_orm(latest_ai_output) if latest_ai_output else None,
                has_active_jobs=has_active_jobs
            )
        )
    
    total_pages = (total + page_size - 1) // page_size
    
    return RequestListResponse(
        requests=request_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("", response_model=CreateRequestResponse)
async def create_request(
    request: CreateRequestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a new TaskFlow request and trigger AI processing"""
    
    # If no workflow specified, use default workflow
    workflow_id = request.workflow_id
    if not workflow_id:
        default_workflow_result = await db.execute(
            select(Workflow).where(Workflow.is_default == True)
        )
        default_workflow = default_workflow_result.scalar_one_or_none()
        if default_workflow:
            workflow_id = default_workflow.id
    
    # Create TaskFlow request
    taskflow_request = Request(
        text=request.text,
        requester=request.requester,
        assigned_analyst_id=request.assigned_analyst_id,
        workflow_id=workflow_id,
        exercise_id=request.exercise_id,
        status=RequestStatus.NEW
    )
    
    db.add(taskflow_request)
    await db.flush()  # Get the ID without committing
    
    # Create processing job - always use WORKFLOW type to ensure editor matches execution
    job_service = JobService(db)
    if workflow_id:
        job_id = await job_service.create_job(
            taskflow_request.id, 
            job_type=JobType.WORKFLOW,
            workflow_id=workflow_id
        )
    else:
        # If no workflow found, this is an error - all requests must use workflows
        raise HTTPException(
            status_code=400, 
            detail="No workflow specified and no default workflow configured. Please create a default workflow."
        )
    
    await db.commit()
    
    logger.info("Created TaskFlow request", request_id=taskflow_request.id, job_id=job_id)
    
    # Generate and store embedding for the new task (after commit)
    try:
        # Refresh the request to get all fields including created_at
        await db.refresh(taskflow_request)
        
        task_data = {
            "title": f"Request #{taskflow_request.id}",
            "description": taskflow_request.text,
            "priority": "normal",
            "status": taskflow_request.status.value,
            "tags": [],
            "exercise_id": taskflow_request.exercise_id,
            "created_at": taskflow_request.created_at.isoformat() if taskflow_request.created_at else ""
        }
        embedding_id = await embedding_service.store_task_embedding(taskflow_request.id, task_data)
        logger.info("Stored embedding for request", request_id=taskflow_request.id, embedding_id=embedding_id)
    except Exception as e:
        logger.error("Failed to store embedding", request_id=taskflow_request.id, error=str(e))
        # Don't fail the request creation if embedding fails
    
    return CreateRequestResponse(id=taskflow_request.id, job_id=job_id)

@router.get("/{request_id}", response_model=RequestResponse)
async def get_request(
    request_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed TaskFlow request information"""
    
    query = select(Request).options(
        selectinload(Request.assigned_analyst),
        selectinload(Request.ai_outputs),
        selectinload(Request.exercise)
    ).where(Request.id == request_id)
    
    result = await db.execute(query)
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get latest AI output
    latest_ai_output = None
    if request.ai_outputs:
        latest_ai_output = max(request.ai_outputs, key=lambda x: x.version)
    
    # Check for active jobs
    active_jobs_result = await db.execute(
        select(ProcessingJob.id)
        .where(ProcessingJob.request_id == request_id)
        .where(ProcessingJob.status.in_([JobStatus.PENDING, JobStatus.RUNNING]))
    )
    has_active_jobs = active_jobs_result.scalar() is not None
    
    # Debug logging
    logger.info(f"Request {request_id}: exercise_id={request.exercise_id}, exercise={request.exercise}")
    
    return RequestResponse(
        id=request.id,
        text=request.text,
        requester=request.requester,
        date_received=request.date_received,
        assigned_analyst_id=request.assigned_analyst_id,
        workflow_id=request.workflow_id,
        exercise_id=request.exercise_id,
        status=request.status,
        due_date=request.due_date,
        created_at=request.created_at,
        updated_at=request.updated_at,
        assigned_analyst=UserResponse.from_orm(request.assigned_analyst) if request.assigned_analyst else None,
        exercise=Exercise.from_orm(request.exercise) if request.exercise else None,
        latest_ai_output=AIOutputResponse.from_orm(latest_ai_output) if latest_ai_output else None,
        has_active_jobs=has_active_jobs
    )

@router.post("/{request_id}/process", response_model=ProcessJobResponse)
async def process_request(
    request_id: int,
    process_request: ProcessRequestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Reprocess request with custom instructions"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if request has custom instructions (new system) or legacy instructions
    custom_instructions_result = await db.execute(
        select(CustomInstruction)
        .where(CustomInstruction.request_id == request_id)
        .where(CustomInstruction.is_active == True)
    )
    has_custom_instructions = len(custom_instructions_result.scalars().all()) > 0
    
    # Create processing job
    job_service = JobService(db)
    from app.models.schemas import JobType
    
    if has_custom_instructions and request.workflow_id:
        # Use WORKFLOW job type for new custom instructions system
        job_id = await job_service.create_job(
            request_id=request_id,
            job_type=JobType.WORKFLOW,
            workflow_id=request.workflow_id,
            custom_instructions=None  # Custom instructions will be fetched by workflow processor
        )
        logger.info("Created workflow reprocessing job with custom instructions", 
                   request_id=request_id, job_id=job_id, workflow_id=request.workflow_id)
    else:
        # Fall back to legacy CUSTOM job type for backward compatibility
        job_id = await job_service.create_job(
            request_id=request_id,
            job_type=JobType.CUSTOM,
            custom_instructions=process_request.instructions
        )
        logger.info("Created legacy custom processing job", 
                   request_id=request_id, job_id=job_id)
    
    return ProcessJobResponse(job_id=job_id)

@router.post("/{request_id}/assign-workflow", response_model=ProcessJobResponse)
async def assign_workflow(
    request_id: int,
    assign_request: AssignWorkflowRequest,
    db: AsyncSession = Depends(get_db)
):
    """Assign a workflow to a request and optionally trigger re-processing"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Verify workflow exists
    workflow_result = await db.execute(
        select(Workflow).where(Workflow.id == assign_request.workflow_id)
    )
    workflow = workflow_result.scalar_one_or_none()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Update request workflow
    request.workflow_id = assign_request.workflow_id
    
    job_id = None
    if assign_request.reprocess:
        # Create new processing job with the assigned workflow
        job_service = JobService(db)
        job_id = await job_service.create_job(
            request_id=request_id,
            job_type=JobType.WORKFLOW,  # New job type for workflow-based processing
            workflow_id=assign_request.workflow_id
        )
        
        logger.info("Created workflow processing job", 
                   request_id=request_id, 
                   workflow_id=assign_request.workflow_id, 
                   job_id=job_id)
    
    await db.commit()
    
    logger.info("Assigned workflow to request", 
                request_id=request_id, 
                workflow_id=assign_request.workflow_id,
                reprocess=assign_request.reprocess)
    
    return ProcessJobResponse(job_id=job_id) if job_id else {"message": "Workflow assigned successfully"}

@router.patch("/{request_id}/status")
async def update_request_status(
    request_id: int,
    status_update: UpdateRequestStatusRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update request status and assignment"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update fields
    request.status = status_update.status
    if status_update.assigned_analyst_id is not None:
        request.assigned_analyst_id = status_update.assigned_analyst_id
    
    await db.commit()
    
    logger.info("Updated request status", 
                request_id=request_id, 
                status=status_update.status.value,
                analyst_id=status_update.assigned_analyst_id)
    
    return {"message": "Status updated successfully"}

@router.put("/{request_id}", response_model=RequestResponse)
async def update_request(
    request_id: int,
    update_data: UpdateRequestRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update a TaskFlow request"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update fields if provided
    if update_data.text is not None:
        request.text = update_data.text
    if update_data.requester is not None:
        request.requester = update_data.requester
    if update_data.status is not None:
        request.status = update_data.status
    if update_data.assigned_analyst_id is not None:
        request.assigned_analyst_id = update_data.assigned_analyst_id
    if update_data.exercise_id is not None:
        request.exercise_id = update_data.exercise_id
    if update_data.due_date is not None:
        from datetime import datetime
        request.due_date = datetime.fromisoformat(update_data.due_date).date()
    
    await db.commit()
    
    # Fetch updated request with relationships
    query = select(Request).options(
        selectinload(Request.assigned_analyst),
        selectinload(Request.ai_outputs)
    ).where(Request.id == request_id)
    
    result = await db.execute(query)
    updated_request = result.scalar_one()
    
    # Get latest AI output
    latest_ai_output = None
    if updated_request.ai_outputs:
        latest_ai_output = max(updated_request.ai_outputs, key=lambda x: x.version)
    
    logger.info("Updated request", request_id=request_id)
    
    return RequestResponse(
        id=updated_request.id,
        text=updated_request.text,
        requester=updated_request.requester,
        date_received=updated_request.date_received,
        assigned_analyst_id=updated_request.assigned_analyst_id,
        workflow_id=updated_request.workflow_id,
        status=updated_request.status,
        due_date=updated_request.due_date,
        created_at=updated_request.created_at,
        updated_at=updated_request.updated_at,
        assigned_analyst=UserResponse.from_orm(updated_request.assigned_analyst) if updated_request.assigned_analyst else None,
        latest_ai_output=AIOutputResponse.from_orm(latest_ai_output) if latest_ai_output else None
    )

@router.delete("/{request_id}")
async def delete_request(
    request_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a TaskFlow request and all associated data"""
    
    # Verify request exists
    result = await db.execute(
        select(Request).where(Request.id == request_id)
    )
    request = result.scalar_one_or_none()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Delete request (cascade will handle AI outputs and jobs)
    await db.delete(request)
    await db.commit()
    
    logger.info("Deleted request", request_id=request_id)
    
    return {"message": "Request deleted successfully"}

@router.post("/search/similar", response_model=SimilaritySearchResponse)
async def search_similar_tasks_by_text(
    search_request: SimilaritySearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Search for tasks similar to a given text query"""
    
    if not search_request.query:
        raise HTTPException(status_code=400, detail="Query text is required")
    
    try:
        # Search similar tasks
        similar_tasks = await embedding_service.search_similar_tasks(
            query_text=search_request.query,
            limit=search_request.limit,
            filters=search_request.filters
        )
        
        # Convert to response format
        response_tasks = []
        for task in similar_tasks:
            response_tasks.append(SimilarTask(
                score=task["score"],
                task_id=task["task_id"],
                title=task["title"],
                description=task["description"],
                priority=task["priority"],
                status=task["status"],
                tags=task["tags"],
                exercise_id=task["exercise_id"],
                created_at=task["created_at"]
            ))
        
        return SimilaritySearchResponse(similar_tasks=response_tasks)
        
    except Exception as e:
        logger.error("Similarity search failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Similarity search failed: {str(e)}")

@router.post("/{request_id}/similar", response_model=SimilaritySearchResponse)
async def search_similar_tasks_by_id(
    request_id: int,
    search_request: SimilaritySearchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Search for tasks similar to a specific request"""
    
    try:
        # Verify request exists
        result = await db.execute(
            select(Request).where(Request.id == request_id)
        )
        request = result.scalar_one_or_none()
        
        if not request:
            raise HTTPException(status_code=404, detail="Request not found")
        
        # Build filters if needed
        filters = {}
        if search_request.restrict_to_exercise and request.exercise_id:
            filters['exercise_id'] = request.exercise_id
        
        # Search similar tasks
        similar_tasks = await embedding_service.search_similar_by_task_id(
            task_id=request_id,
            limit=search_request.limit,
            exclude_self=True,
            filters=filters
        )
        
        # Filter by threshold
        filtered_tasks = [
            task for task in similar_tasks 
            if task['score'] >= search_request.threshold
        ]
        
        # Convert to response format
        response_tasks = []
        for task in filtered_tasks:
            response_tasks.append(SimilarTask(
                score=task["score"],
                task_id=task["task_id"],
                title=task["title"],
                description=task["description"],
                priority=task["priority"],
                status=task["status"],
                tags=task["tags"],
                exercise_id=task["exercise_id"],
                created_at=task["created_at"]
            ))
        
        return SimilaritySearchResponse(similar_tasks=response_tasks)
        
    except Exception as e:
        logger.error("Similarity search failed", request_id=request_id, error=str(e))
        raise HTTPException(status_code=500, detail=f"Similarity search failed: {str(e)}")

@router.get("/test-exercise-assignment")
async def test_exercise_assignment(db: AsyncSession = Depends(get_db)):
    """Test endpoint to debug exercise assignment"""
    # Get exercises
    exercise_result = await db.execute(
        select(ExerciseModel).where(Exercise.name == "FOIA")
    )
    exercise = exercise_result.scalar_one_or_none()
    
    if not exercise:
        return {"error": "FOIA exercise not found"}
    
    # Create a test request with exercise
    test_request = Request(
        text="Test exercise assignment",
        requester="test@example.com",
        exercise_id=exercise.id,
        status=RequestStatus.NEW
    )
    
    db.add(test_request)
    await db.flush()
    
    # Check if it persisted
    check_result = await db.execute(
        select(Request).where(Request.id == test_request.id)
    )
    saved_request = check_result.scalar_one()
    
    await db.rollback()  # Don't actually save
    
    return {
        "exercise_id_before_save": exercise.id,
        "request_exercise_id_after_add": test_request.exercise_id,
        "saved_request_exercise_id": saved_request.exercise_id,
        "exercise_name": exercise.name
    }

@router.post("/batch", response_model=BatchUploadResponse)
async def batch_upload_requests(
    file: UploadFile = File(...),
    exercise_id: Optional[int] = Query(None, description="Exercise ID to assign all uploaded requests to"),
    db: AsyncSession = Depends(get_db)
):
    """Batch upload requests from CSV or Excel file"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Validate exercise_id if provided
    if exercise_id:
        logger.info(f"Batch upload with exercise_id: {exercise_id}")
        exercise_result = await db.execute(
            select(ExerciseModel).where(ExerciseModel.id == exercise_id)
        )
        exercise = exercise_result.scalar_one_or_none()
        if not exercise:
            raise HTTPException(status_code=404, detail=f"Exercise with ID {exercise_id} not found")
        logger.info(f"Found exercise: {exercise.name} with ID {exercise.id}")
    
    # Validate file type
    file_extension = file.filename.lower().split('.')[-1]
    if file_extension not in ['csv', 'xlsx', 'xls']:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload a CSV or Excel file."
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Parse based on file type
        if file_extension == 'csv':
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        
        # Validate required columns
        required_columns = ['text']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # Get default workflow if available
        default_workflow_result = await db.execute(
            select(Workflow).where(Workflow.is_default == True)
        )
        default_workflow = default_workflow_result.scalar_one_or_none()
        default_workflow_id = default_workflow.id if default_workflow else None
        
        total_rows = len(df)
        success_count = 0
        errors = []
        job_service = JobService(db)
        
        # Process each row
        for index, row in df.iterrows():
            row_number = index + 2  # Excel row number (accounting for header)
            
            try:
                # Validate required fields
                if pd.isna(row['text']) or not str(row['text']).strip():
                    errors.append(BatchUploadError(
                        row=row_number,
                        message="Text field is required and cannot be empty"
                    ))
                    continue
                
                # Prepare request data
                text = str(row['text']).strip()
                requester = str(row['requester']).strip() if not pd.isna(row.get('requester')) else None
                assigned_analyst_id = int(row['assigned_analyst_id']) if not pd.isna(row.get('assigned_analyst_id')) else None
                
                # Handle workflow - support both workflow_id (legacy) and workflow_name
                workflow_id = default_workflow_id
                if not pd.isna(row.get('workflow_id')):
                    # Legacy support for workflow_id
                    workflow_id = int(row['workflow_id'])
                elif not pd.isna(row.get('workflow_name')):
                    # New workflow_name support
                    workflow_name = str(row['workflow_name']).strip()
                    workflow_result = await db.execute(
                        select(Workflow).where(Workflow.name == workflow_name)
                    )
                    workflow = workflow_result.scalar_one_or_none()
                    if workflow:
                        workflow_id = workflow.id
                    else:
                        errors.append(BatchUploadError(
                            row=row_number,
                            message=f"Workflow '{workflow_name}' not found"
                        ))
                        continue
                
                # Parse due_date if provided
                due_date = None
                if not pd.isna(row.get('due_date')):
                    try:
                        due_date_str = str(row['due_date'])
                        due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
                    except ValueError:
                        errors.append(BatchUploadError(
                            row=row_number,
                            message="Invalid due_date format. Use YYYY-MM-DD"
                        ))
                        continue
                
                # Validate text length
                if len(text) < 10:
                    errors.append(BatchUploadError(
                        row=row_number,
                        message="Text must be at least 10 characters long"
                    ))
                    continue
                
                if len(text) > 50000:
                    errors.append(BatchUploadError(
                        row=row_number,
                        message="Text must be less than 50,000 characters"
                    ))
                    continue
                
                # Validate analyst ID if provided
                if assigned_analyst_id:
                    analyst_result = await db.execute(
                        select(User).where(User.id == assigned_analyst_id)
                    )
                    analyst = analyst_result.scalar_one_or_none()
                    if not analyst:
                        errors.append(BatchUploadError(
                            row=row_number,
                            message=f"Analyst with ID {assigned_analyst_id} not found"
                        ))
                        continue
                
                # Validate workflow ID if provided
                if workflow_id:
                    workflow_result = await db.execute(
                        select(Workflow).where(Workflow.id == workflow_id)
                    )
                    workflow = workflow_result.scalar_one_or_none()
                    if not workflow:
                        errors.append(BatchUploadError(
                            row=row_number,
                            message=f"Workflow with ID {workflow_id} not found"
                        ))
                        continue
                
                # Use the exercise_id passed from the frontend (the selected exercise)
                # The exercise_id parameter is already validated at the start of the function
                
                
                # Create request
                logger.info(f"Creating request with exercise_id: {exercise_id}")
                
                request = Request(
                    text=text,
                    requester=requester,
                    assigned_analyst_id=assigned_analyst_id,
                    workflow_id=workflow_id,
                    exercise_id=exercise_id,
                    status=RequestStatus.NEW,
                    due_date=due_date
                )
                
                
                db.add(request)
                await db.flush()  # Get the ID without committing
                
                
                # Create processing job if workflow is assigned
                if workflow_id:
                    job_id = await job_service.create_job(
                        request.id,
                        job_type=JobType.WORKFLOW,
                        workflow_id=workflow_id
                    )
                
                success_count += 1
                
            except Exception as e:
                errors.append(BatchUploadError(
                    row=row_number,
                    message=f"Error processing row: {str(e)}"
                ))
                continue
        
        # Commit all successful requests
        await db.commit()
        
        success = len(errors) == 0
        
        logger.info("Batch upload completed", 
                   total_rows=total_rows, 
                   success_count=success_count, 
                   error_count=len(errors))
        
        return BatchUploadResponse(
            success=success,
            total_rows=total_rows,
            success_count=success_count,
            errors=errors
        )
        
    except Exception as e:
        await db.rollback()
        logger.error("Batch upload failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch upload failed: {str(e)}")

@router.post("/bulk-rerun", response_model=BulkRerunResponse)
async def bulk_rerun_requests(
    request: BulkRerunRequest,
    db: AsyncSession = Depends(get_db)
):
    """Re-run all requests with a specified workflow"""
    
    try:
        # Verify workflow exists
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == request.workflow_id)
        )
        workflow = workflow_result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Get all requests
        requests_result = await db.execute(select(Request))
        all_requests = requests_result.scalars().all()
        
        total_tasks = len(all_requests)
        success_count = 0
        errors = []
        job_service = JobService(db)
        
        # Process each request
        for req in all_requests:
            try:
                # Update request workflow if different
                if req.workflow_id != request.workflow_id:
                    req.workflow_id = request.workflow_id
                
                # Create new processing job
                job_id = await job_service.create_job(
                    req.id,
                    job_type=JobType.WORKFLOW,
                    workflow_id=request.workflow_id
                )
                
                success_count += 1
                
            except Exception as e:
                errors.append(BulkRerunError(
                    task_id=req.id,
                    message=f"Error creating job: {str(e)}"
                ))
                continue
        
        # Commit all changes
        await db.commit()
        
        success = len(errors) == 0
        
        logger.info("Bulk rerun completed", 
                   total_tasks=total_tasks, 
                   success_count=success_count, 
                   error_count=len(errors),
                   workflow_id=request.workflow_id)
        
        return BulkRerunResponse(
            success=success,
            total_tasks=total_tasks,
            success_count=success_count,
            errors=errors
        )
        
    except Exception as e:
        await db.rollback()
        logger.error("Bulk rerun failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Bulk rerun failed: {str(e)}")