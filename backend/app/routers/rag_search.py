from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models.database import get_db
from app.models.pydantic_models import RAGSearchRequest, RAGSearchResponse, RAGSearchResult
from app.routers.auth import get_current_user
from app.models.pydantic_models import User
from app.services.embedding_service import embedding_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag-search", tags=["rag-search"])

@router.post("/search", response_model=RAGSearchResponse)
async def perform_rag_search(
    request: RAGSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform a RAG (Retrieval-Augmented Generation) search across tasks.
    
    This endpoint allows users to search for similar tasks using natural language queries.
    The search is performed using vector embeddings and returns the most similar tasks.
    """
    try:
        # Check if user has specified exercise filter
        filters = request.filters or {}
        
        # Add exercise filter based on user permissions if needed
        # For now, we'll search across all exercises the user has access to
        
        # Perform the similarity search
        similar_tasks = await embedding_service.search_similar_tasks(
            query_text=request.query,
            limit=request.limit,
            filters=filters
        )
        
        # Convert to response format
        results = []
        for task in similar_tasks:
            result = RAGSearchResult(
                task_id=task["task_id"],
                title=task.get("title", f"Task #{task['task_id']}"),
                description=task.get("description", ""),
                similarity_score=task["score"],
                status=task.get("status", ""),
                priority=task.get("priority"),
                created_at=task.get("created_at"),
                exercise_id=task.get("exercise_id")
            )
            results.append(result)
        
        return RAGSearchResponse(
            results=results,
            query=request.query,
            total_results=len(results)
        )
        
    except Exception as e:
        logger.error(f"Error performing RAG search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error performing search: {str(e)}")

@router.get("/parameters")
async def get_search_parameters(
    current_user: User = Depends(get_current_user)
):
    """Get available search parameters and their defaults."""
    return {
        "max_results": {
            "default": 5,
            "min": 1,
            "max": 20,
            "description": "Maximum number of results to return"
        },
        "temperature": {
            "default": 0.7,
            "min": 0.0,
            "max": 1.0,
            "description": "Temperature for result diversity (higher = more diverse)"
        },
        "filters": {
            "exercise_id": {
                "type": "integer",
                "description": "Filter by specific exercise"
            },
            "priority": {
                "type": "string",
                "options": ["low", "medium", "high"],
                "description": "Filter by priority level"
            },
            "status": {
                "type": "string",
                "options": ["NEW", "IN_REVIEW", "PENDING", "CLOSED"],
                "description": "Filter by task status"
            }
        }
    }