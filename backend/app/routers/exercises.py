from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from typing import List, Optional
from app.models.database import get_db
from app.models.schemas import Exercise as ExerciseModel, Request as RequestModel
from app.models.pydantic_models import (
    Exercise, ExerciseCreate, ExerciseUpdate
)

router = APIRouter(
    prefix="/exercises",
    tags=["exercises"]
)

@router.get("/", response_model=List[Exercise])
async def list_exercises(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db)
):
    """List all exercises, optionally filtered by active status"""
    query = select(ExerciseModel)
    
    if is_active is not None:
        query = query.filter(ExerciseModel.is_active == is_active)
    
    # Sort alphabetically by name
    query = query.order_by(ExerciseModel.name)
    
    result = await db.execute(query)
    exercises = result.scalars().all()
    return exercises

@router.get("/{exercise_id}", response_model=Exercise)
async def get_exercise(
    exercise_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific exercise by ID"""
    query = select(ExerciseModel).filter(ExerciseModel.id == exercise_id)
    result = await db.execute(query)
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise

@router.post("/", response_model=Exercise)
async def create_exercise(
    exercise_data: ExerciseCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new exercise"""
    # Check if exercise with same name already exists
    query = select(ExerciseModel).filter(
        func.lower(ExerciseModel.name) == func.lower(exercise_data.name)
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Exercise with name '{exercise_data.name}' already exists"
        )
    
    exercise = ExerciseModel(
        **exercise_data.dict(),
        created_by=1  # TODO: Get from current user when auth is implemented
    )
    
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise)
    
    return exercise

@router.put("/{exercise_id}", response_model=Exercise)
async def update_exercise(
    exercise_id: int,
    exercise_data: ExerciseUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing exercise"""
    query = select(ExerciseModel).filter(ExerciseModel.id == exercise_id)
    result = await db.execute(query)
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    # Check if new name conflicts with existing exercise
    if exercise_data.name:
        check_query = select(ExerciseModel).filter(
            func.lower(ExerciseModel.name) == func.lower(exercise_data.name),
            ExerciseModel.id != exercise_id
        )
        check_result = await db.execute(check_query)
        existing = check_result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Exercise with name '{exercise_data.name}' already exists"
            )
    
    # Update fields
    update_data = exercise_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exercise, field, value)
    
    await db.commit()
    await db.refresh(exercise)
    
    return exercise

@router.delete("/{exercise_id}")
async def delete_exercise(
    exercise_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete an exercise (soft delete by setting is_active=False)"""
    query = select(ExerciseModel).filter(ExerciseModel.id == exercise_id)
    result = await db.execute(query)
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    # Check if there are any requests associated with this exercise
    count_query = select(func.count(RequestModel.id)).filter(
        RequestModel.exercise_id == exercise_id
    )
    count_result = await db.execute(count_query)
    request_count = count_result.scalar()
    
    if request_count > 0:
        # Soft delete - just deactivate
        exercise.is_active = False
        await db.commit()
        return {"message": f"Exercise deactivated (has {request_count} associated requests)"}
    else:
        # Hard delete if no associated requests
        await db.delete(exercise)
        await db.commit()
        return {"message": "Exercise deleted"}

@router.get("/{exercise_id}/requests/count")
async def get_exercise_request_count(
    exercise_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get the count of requests associated with an exercise"""
    query = select(ExerciseModel).filter(ExerciseModel.id == exercise_id)
    result = await db.execute(query)
    exercise = result.scalar_one_or_none()
    
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    
    count_query = select(func.count(RequestModel.id)).filter(
        RequestModel.exercise_id == exercise_id
    )
    count_result = await db.execute(count_query)
    count = count_result.scalar()
    
    return {"exercise_id": exercise_id, "request_count": count}