"""
API endpoints for managing domain configuration and prompts.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import httpx
import structlog
from app.config import settings
from app.models.pydantic_models import User
from app.routers.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter(prefix="/api/config", tags=["configuration"])

@router.get("/domain")
async def get_domain_config(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Get the current domain configuration."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.ai_worker_url}/config/domain")
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error("Failed to fetch domain config", error=str(e))
        raise HTTPException(status_code=503, detail="AI worker service unavailable")
    except httpx.HTTPStatusError as e:
        logger.error("AI worker returned error", status_code=e.response.status_code)
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch domain config")

@router.put("/domain")
async def update_domain_config(
    config: Dict[str, Any],
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Update the domain configuration. Requires admin privileges."""
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{settings.ai_worker_url}/config/domain",
                json=config
            )
            response.raise_for_status()
            
        logger.info("Domain configuration updated", user_id=current_user.id)
        return {"message": "Domain configuration updated successfully"}
        
    except httpx.RequestError as e:
        logger.error("Failed to update domain config", error=str(e))
        raise HTTPException(status_code=503, detail="AI worker service unavailable")
    except httpx.HTTPStatusError as e:
        logger.error("AI worker returned error", status_code=e.response.status_code)
        raise HTTPException(status_code=e.response.status_code, detail="Failed to update domain config")

@router.get("/prompts/{prompt_type}")
async def get_prompt_template(
    prompt_type: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """Get a specific prompt template."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.ai_worker_url}/config/prompts/{prompt_type}")
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error("Failed to fetch prompt template", prompt_type=prompt_type, error=str(e))
        raise HTTPException(status_code=503, detail="AI worker service unavailable")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Prompt type '{prompt_type}' not found")
        logger.error("AI worker returned error", status_code=e.response.status_code)
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch prompt template")

@router.get("/terminology")
async def get_terminology(current_user: User = Depends(get_current_user)) -> Dict[str, str]:
    """Get current domain terminology."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.ai_worker_url}/config/terminology")
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error("Failed to fetch terminology", error=str(e))
        raise HTTPException(status_code=503, detail="AI worker service unavailable")
    except httpx.HTTPStatusError as e:
        logger.error("AI worker returned error", status_code=e.response.status_code)
        raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch terminology")