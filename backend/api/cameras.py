"""
Camera API endpoints
Manage cameras (webcam, RTSP, file sources)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.database.connection import get_db
from backend.database import crud, schemas


router = APIRouter(prefix="/cameras", tags=["Cameras"])


@router.get("/", response_model=List[schemas.CameraResponse])
async def get_cameras(
    skip: int = 0,
    limit: int = 100,
    domain_id: int = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all cameras with optional domain filtering
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    - **domain_id**: Filter by domain (optional)
    """
    if domain_id:
        cameras = await crud.get_cameras_by_domain(db, domain_id)
    else:
        cameras = await crud.get_cameras(db, skip=skip, limit=limit)
    return cameras


@router.get("/{camera_id}", response_model=schemas.CameraResponse)
async def get_camera(
    camera_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific camera by ID
    """
    camera = await crud.get_camera_by_id(db, camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    return camera


@router.post("/", response_model=schemas.CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(
    camera: schemas.CameraCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new camera
    
    - **name**: Camera display name
    - **domain_id**: Domain this camera belongs to
    - **source_type**: webcam, rtsp, or file
    - **source_uri**: Camera source (e.g., "0" for webcam, "rtsp://..." for IP cam)
    - **is_active**: Whether camera is active
    - **location**: Optional physical location
    """
    # Check if domain exists
    domain = await crud.get_domain_by_id(db, camera.domain_id)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {camera.domain_id} not found"
        )
    
    return await crud.create_camera(db, camera)


@router.put("/{camera_id}", response_model=schemas.CameraResponse)
async def update_camera(
    camera_id: int,
    camera: schemas.CameraUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a camera
    
    All fields are optional. Only provided fields will be updated.
    """
    # If domain_id is being updated, check if it exists
    if camera.domain_id:
        domain = await crud.get_domain_by_id(db, camera.domain_id)
        if not domain:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Domain with id {camera.domain_id} not found"
            )
    
    updated_camera = await crud.update_camera(db, camera_id, camera)
    if not updated_camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    return updated_camera


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(
    camera_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a camera
    
    **Warning:** This will also delete all violations from this camera!
    """
    success = await crud.delete_camera(db, camera_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    return None

