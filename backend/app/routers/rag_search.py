from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.models.pydantic_models import (
    RAGSearchRequest,
    RAGSearchResponse,
    RAGSearchResult,
    User,
)
from app.routers.auth import get_current_user

# Conditional import to prevent startup failures
try:
    from app.services.embedding_service import embedding_service
except Exception as e:
    print(f"WARNING: EmbeddingService failed to initialize in rag_search: {e}")
    embedding_service = None
import json
import logging

from sqlalchemy import select

from app.models.schemas import AIOutput, Request, WorkflowSimilarityConfig

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag-search", tags=["rag-search"])


@router.post("/search", response_model=RAGSearchResponse)
async def perform_rag_search(
    search_request: RAGSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Perform a RAG (Retrieval-Augmented Generation) search across tasks.

    This endpoint allows users to search for similar tasks using natural language queries.
    The search is performed using vector embeddings and returns the most similar tasks.
    """
    logger.info(
        f"RAG search request received - Query: '{search_request.query}', "
        f"Limit: {search_request.limit}, Filters: {search_request.filters}"
    )

    try:
        # Check if user has specified exercise filter
        filters = search_request.filters or {}

        # Add exercise filter based on user permissions if needed
        # For now, we'll search across all exercises the user has access to

        if not embedding_service or not embedding_service.is_available():
            raise HTTPException(
                status_code=503, detail="Embedding service not available"
            )

        logger.info("About to call embedding_service.search_similar_tasks...")

        # Perform the similarity search
        similar_tasks = await embedding_service.search_similar_tasks(
            query_text=search_request.query, limit=search_request.limit, filters=filters
        )

        logger.info(
            f"Search completed successfully, found {len(similar_tasks)} results"
        )

        # Convert to response format with custom display configuration
        results = []
        for task in similar_tasks:
            # Get the request and its workflow configuration
            request_result = await db.execute(
                select(Request).where(Request.id == task["task_id"])
            )
            request = request_result.scalar_one_or_none()

            # Default display data
            display_data = {
                "task_id": task["task_id"],
                "title": f"Task #{task['task_id']}",
                "description": task.get("description", ""),
                "similarity_score": task["score"],
                "status": task.get("status", ""),
                "priority": task.get("priority"),
                "created_at": task.get("created_at"),
                "exercise_id": task.get("exercise_id"),
            }

            # If request found, check for custom similarity display config
            if request and request.workflow_id:
                config_result = await db.execute(
                    select(WorkflowSimilarityConfig).where(
                        WorkflowSimilarityConfig.workflow_id == request.workflow_id
                    )
                )
                similarity_config = config_result.scalar_one_or_none()

                if similarity_config and similarity_config.fields:
                    # Build custom display based on configuration
                    custom_display = await _build_custom_display(
                        request, similarity_config.fields, task["score"], db
                    )
                    display_data.update(custom_display)

            result = RAGSearchResult(**display_data)
            results.append(result)

        return RAGSearchResponse(
            results=results, query=search_request.query, total_results=len(results)
        )

    except Exception as e:
        logger.error(f"Error performing RAG search: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error performing search: {str(e)}"
        )


@router.get("/parameters")
async def get_search_parameters(current_user: User = Depends(get_current_user)):
    """Get available search parameters and their defaults."""
    return {
        "max_results": {
            "default": 5,
            "min": 1,
            "max": 20,
            "description": "Maximum number of results to return",
        },
        "temperature": {
            "default": 0.7,
            "min": 0.0,
            "max": 1.0,
            "description": "Temperature for result diversity (higher = more diverse)",
        },
        "filters": {
            "exercise_id": {
                "type": "integer",
                "description": "Filter by specific exercise",
            },
            "priority": {
                "type": "string",
                "options": ["low", "medium", "high"],
                "description": "Filter by priority level",
            },
            "status": {
                "type": "string",
                "options": ["NEW", "IN_REVIEW", "PENDING", "CLOSED"],
                "description": "Filter by task status",
            },
        },
    }


async def _build_custom_display(
    request: Request, field_configs: list, similarity_score: float, db: AsyncSession
) -> dict:
    """Build custom display data based on workflow similarity configuration"""
    custom_data = {}

    # Get AI output for this request
    output_query = await db.execute(
        select(AIOutput)
        .where(AIOutput.request_id == request.id)
        .order_by(AIOutput.version.desc())
    )
    ai_output = output_query.scalars().first()

    # Build result lookup from AI output
    results_by_block = {}
    if ai_output and ai_output.summary:
        try:
            summary_data = json.loads(ai_output.summary)
            results_by_block = summary_data
        except Exception as e:
            logger.warning(f"Failed to parse AI output summary: {str(e)}")

    # Process each configured field
    for field_config in field_configs:
        field_name = field_config.get("name", "")
        field_source = field_config.get("source", "")
        field_type = field_config.get("type", "text")

        if not field_name or not field_source:
            continue

        # Get value based on source
        value = None

        if field_source == "TASK_ID":
            value = request.id
        elif field_source == "REQUEST_TEXT":
            value = request.text
        elif field_source == "SIMILARITY_SCORE":
            value = similarity_score
        elif field_source == "STATUS":
            value = request.status.value if request.status else ""
        elif field_source == "CREATED_AT":
            value = request.created_at.isoformat() if request.created_at else ""
        elif field_source == "REQUESTER":
            value = request.requester
        elif "." in field_source:
            # Handle block output fields (e.g., "Summarize.executive_summary")
            block_name, field_path = field_source.split(".", 1)
            if block_name in results_by_block:
                block_data = results_by_block[block_name]
                if isinstance(block_data, dict):
                    value = block_data.get(field_path, "")
                else:
                    value = block_data
        elif field_source in results_by_block:
            # Full block output
            value = results_by_block[field_source]

        # Format value based on type
        if value is not None:
            if field_type == "text" and not isinstance(value, str):
                value = str(value)
            elif field_type == "number":
                try:
                    value = float(value)
                except ValueError:
                    value = 0
            elif field_type == "score":
                value = round(similarity_score * 100, 1)  # Convert to percentage

            # Use sanitized field name for response
            safe_field_name = field_name.lower().replace(" ", "_")
            custom_data[safe_field_name] = value

    # Always include these core fields
    custom_data["task_id"] = request.id
    custom_data["similarity_score"] = similarity_score

    return custom_data
