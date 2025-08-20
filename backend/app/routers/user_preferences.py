from typing import Any, Dict, cast

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.database import get_db
from app.models.pydantic_models import UpdateUserPreferencesRequest, UserPreferencesResponse
from app.models.schemas import User

logger = structlog.get_logger()
router = APIRouter(prefix="/api/user-preferences", tags=["user-preferences"])


# For now, we'll use a hardcoded user ID. In production, get from auth
def get_current_user_id() -> int:
    return 1  # Default admin user


@router.get("", response_model=UserPreferencesResponse)
async def get_user_preferences(db: AsyncSession = Depends(get_db)):
    """Get current user's preferences"""
    try:
        current_user_id = get_current_user_id()

        stmt = select(User).where(User.id == current_user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Parse preferences from JSON column
        preferences: Dict[str, Any] = cast(Dict[str, Any], user.preferences) or {}

        return UserPreferencesResponse(fine_tuning_mode=preferences.get("fine_tuning_mode", False))

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get user preferences", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("", response_model=UserPreferencesResponse)
async def update_user_preferences(
    preferences: UpdateUserPreferencesRequest, db: AsyncSession = Depends(get_db)
):
    """Update current user's preferences"""
    try:
        current_user_id = get_current_user_id()

        stmt = select(User).where(User.id == current_user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get existing preferences
        current_preferences: Dict[str, Any] = cast(Dict[str, Any], user.preferences) or {}

        # Update with new values
        if preferences.fine_tuning_mode is not None:
            current_preferences["fine_tuning_mode"] = preferences.fine_tuning_mode

        # Save back to database
        user.preferences = current_preferences  # type: ignore[assignment]
        # Flag the JSON column as modified so SQLAlchemy knows to update it
        flag_modified(user, "preferences")

        await db.commit()
        await db.refresh(user)

        return UserPreferencesResponse(
            fine_tuning_mode=current_preferences.get("fine_tuning_mode", False)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update user preferences", error=str(e))
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
