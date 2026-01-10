"""
PPE Type API endpoints
Manage PPE types (helmet, vest, gloves, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.database.connection import get_db
from backend.database import crud, schemas
from backend.services.ppe_type_service import PPETypeService
from backend.utils.logger import logger


router = APIRouter(prefix="/ppe-types", tags=["PPE Types"])


@router.get("", response_model=List[schemas.PPETypeResponse])
async def get_ppe_types(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all PPE types with pagination
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    """
    service = PPETypeService(db)
    ppe_types = await service.get_all(skip=skip, limit=limit)
    return ppe_types


@router.get("/{ppe_type_id}", response_model=schemas.PPETypeResponse)
async def get_ppe_type(
    ppe_type_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific PPE type by ID
    """
    service = PPETypeService(db)
    ppe_type = await service.get_by_id(ppe_type_id)
    if not ppe_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PPE type with id {ppe_type_id} not found"
        )
    return ppe_type


@router.post("", response_model=schemas.PPETypeResponse, status_code=status.HTTP_201_CREATED)
async def create_ppe_type(
    ppe_type: schemas.PPETypeCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new PPE type
    
    - **name**: Internal name (e.g., "hard_hat")
    - **display_name**: Display name (e.g., "Baret")
    - **category**: Category (head, eye, hand, foot, ear, body, face)
    - **model_class_name**: YOLO model class name (optional)
    - **status**: active or planned
    """
    service = PPETypeService(db)
    return await service.create(ppe_type)


@router.put("/{ppe_type_id}", response_model=schemas.PPETypeResponse)
async def update_ppe_type(
    ppe_type_id: int,
    ppe_type: schemas.PPETypeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a PPE type
    
    All fields are optional. Only provided fields will be updated.
    """
    service = PPETypeService(db)
    updated_ppe_type = await service.update(ppe_type_id, ppe_type)
    if not updated_ppe_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PPE type with id {ppe_type_id} not found"
        )
    return updated_ppe_type

