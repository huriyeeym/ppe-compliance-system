"""
Camera API endpoints
Manage cameras (webcam, RTSP, file sources)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.database.connection import get_db
from backend.database import crud, schemas
from backend.services.camera_service import CameraService
from backend.utils.logger import logger
from backend.utils.permissions import has_permission, Permission
from backend.api.auth import get_current_user


router = APIRouter(prefix="/cameras", tags=["Cameras"])


@router.get("", response_model=List[schemas.CameraResponse])
async def get_cameras(
    skip: int = 0,
    limit: int = 100,
    domain_id: int = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all cameras with optional domain filtering
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    - **domain_id**: Filter by domain (optional)
    
    **Note:** Only cameras from the current user's organization are returned.
    """
    service = CameraService(db)
    # CRITICAL: Filter by organization_id for multi-tenant isolation
    cameras = await service.get_all(skip=skip, limit=limit, domain_id=domain_id, organization_id=current_user.organization_id)
    return cameras


@router.get("/{camera_id}", response_model=schemas.CameraResponse)
async def get_camera(
    camera_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific camera by ID
    
    **Note:** Only cameras from the current user's organization are accessible.
    """
    service = CameraService(db)
    # CRITICAL: Filter by organization_id for multi-tenant isolation
    camera = await service.get_by_id(camera_id, organization_id=current_user.organization_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    return camera


@router.post("", response_model=schemas.CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(
    camera: schemas.CameraCreate,
    current_user=Depends(get_current_user),
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
    
    **Note:** The camera will be automatically assigned to the current user's organization.
    
    **Permissions:**
    - Only ADMIN and SUPER_ADMIN can create cameras
    """
    if not has_permission(current_user, Permission.CAMERAS_CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create cameras"
        )
    service = CameraService(db)
    try:
        # CRITICAL: Auto-set organization_id from current_user (ignore client input)
        return await service.create(camera, organization_id=current_user.organization_id)
    except ValueError as e:
        logger.error(f"Camera creation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error creating camera: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create camera: {str(e)}"
        )


@router.put("/{camera_id}", response_model=schemas.CameraResponse)
async def update_camera(
    camera_id: int,
    camera: schemas.CameraUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Update a camera
    
    All fields are optional. Only provided fields will be updated.
    
    **Permissions:**
    - Only ADMIN and SUPER_ADMIN can update cameras
    """
    if not has_permission(current_user, Permission.CAMERAS_UPDATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update cameras"
        )
    service = CameraService(db)
    try:
        updated_camera = await service.update(camera_id, camera)
        if not updated_camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Camera with id {camera_id} not found"
            )
        return updated_camera
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Delete a camera
    
    **Warning:** This will also delete all violations from this camera!
    
    **Permissions:**
    - Only ADMIN and SUPER_ADMIN can delete cameras
    """
    if not has_permission(current_user, Permission.CAMERAS_DELETE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete cameras"
        )
    service = CameraService(db)
    success = await service.delete(camera_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {camera_id} not found"
        )
    return None

