from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, List
from app.models.database import get_db
from app.models.schemas import SystemSettings
from app.models.pydantic_models import SystemSettingResponse, UpdateSystemSettingRequest
from app.routers.auth import get_current_user
from app.models.pydantic_models import User

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/system", response_model=List[SystemSettingResponse])
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all system settings."""
    result = await db.execute(select(SystemSettings))
    settings = result.scalars().all()
    return settings

@router.get("/system/{key}", response_model=SystemSettingResponse)
async def get_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific system setting by key."""
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    
    return setting

@router.put("/system/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    request: UpdateSystemSettingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a system setting value."""
    # Only admins can update system settings
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only administrators can update system settings")
    
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.key == key)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' not found")
    
    setting.value = request.value
    await db.commit()
    await db.refresh(setting)
    
    return setting

@router.get("/rag-search-enabled", response_model=Dict[str, bool])
async def get_rag_search_enabled(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the RAG search enabled setting."""
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.key == "rag_search_enabled")
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        # Default to true if setting doesn't exist
        return {"enabled": True}
    
    # The value is stored as JSON, so it could be a string "true" or boolean true
    value = setting.value
    if isinstance(value, str):
        enabled = value.lower() == "true"
    else:
        enabled = bool(value)
    
    return {"enabled": enabled}