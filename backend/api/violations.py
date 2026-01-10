"""
Violation API endpoints
Manage PPE violations with filtering and statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from backend.database.connection import get_db
from backend.database import crud, schemas
from backend.database.models import ViolationSeverity, ViolationStatus
from backend.services.violation_service import ViolationService
from backend.utils.logger import logger
from backend.utils.permissions import has_permission, Permission
from backend.config import settings
from backend.api.auth import get_current_user


router = APIRouter(prefix="/violations", tags=["Violations"])


@router.get("", response_model=schemas.PaginatedResponse)
async def get_violations(
    domain_id: Optional[int] = Query(None, description="Filter by domain"),
    camera_id: Optional[int] = Query(None, description="Filter by camera"),
    status: Optional[ViolationStatus] = Query(None, description="Filter by workflow status"),
    severity: Optional[ViolationSeverity] = Query(None, description="Filter by severity"),
    missing_ppe_type: Optional[str] = Query(None, description="Filter by missing PPE type (e.g., 'hard_hat', 'safety_vest')"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get violations with filtering and pagination
    
    **Filters:**
    - **domain_id**: Show violations from specific domain
    - **camera_id**: Show violations from specific camera
    - **status**: Filter by workflow status (open, in_progress, closed, false_positive)
    - **severity**: Filter by severity (critical, high, medium, low)
    - **missing_ppe_type**: Filter by missing PPE type (e.g., 'hard_hat', 'safety_vest')
    - **start_date**: Violations after this date
    - **end_date**: Violations before this date
    
    **Pagination:**
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records (max 100)
    
    **Returns:**
    Paginated response with total count and items
    """
    filters = schemas.ViolationFilterParams(
        domain_id=domain_id,
        camera_id=camera_id,
        status=status,
        severity=severity,
        missing_ppe_type=missing_ppe_type,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )
    
    # Use service layer instead of direct CRUD
    # CRITICAL: Filter by organization_id for multi-tenant isolation
    service = ViolationService(db)
    violations, total = await service.get_violations(filters, organization_id=current_user.organization_id)
    
    return schemas.PaginatedResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=[schemas.ViolationResponse.model_validate(v) for v in violations]
    )


@router.get("/stats", response_model=dict)
async def get_violation_statistics(
    domain_id: Optional[int] = Query(None, description="Filter by domain"),
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get violation statistics
    
    Returns:
    - total_violations: Total number of violations
    - acknowledged: Number of acknowledged violations
    - pending: Number of pending violations
    
    **Note:** Only statistics from the current user's organization are returned.
    """
    service = ViolationService(db)
    # CRITICAL: Filter by organization_id for multi-tenant isolation
    stats = await service.get_statistics(domain_id, start_date, end_date, organization_id=current_user.organization_id)
    return stats


@router.get("/{violation_id}", response_model=schemas.ViolationResponse)
async def get_violation(
    violation_id: int,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific violation by ID
    
    **Note:** Only violations from the current user's organization are accessible.
    """
    service = ViolationService(db)
    # CRITICAL: Filter by organization_id for multi-tenant isolation
    violation = await service.get_violation_by_id(violation_id, organization_id=current_user.organization_id)
    if not violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation with id {violation_id} not found"
        )
    return violation


@router.post("", response_model=schemas.ViolationResponse, status_code=status.HTTP_201_CREATED)
async def create_violation(
    violation: schemas.ViolationCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new violation
    
    **Note:** This endpoint is typically called by the ML engine, not manually.
    
    Required fields:
    - **camera_id**: Camera that detected the violation
    - **domain_id**: Domain of the camera
    - **person_bbox**: Bounding box of detected person
    - **detected_ppe**: List of detected PPE items
    - **missing_ppe**: List of missing PPE items
    - **confidence**: Detection confidence (0.0 - 1.0)
    """
    # Use service layer for business logic
    service = ViolationService(db)
    try:
        return await service.create_violation(violation)
    except ValueError as e:
        # Service layer validation errors
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{violation_id}", response_model=schemas.ViolationResponse)
async def update_violation(
    violation_id: int,
    violation: schemas.ViolationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Update a violation (workflow management)
    
    **Workflow fields:**
    - **status**: Change workflow status (open, in_progress, closed, false_positive)
    - **assigned_to**: Assign to user (email/username)
    - **notes**: Add notes/comments
    - **corrective_action**: Describe corrective action taken
    
    **Legacy fields (deprecated):**
    - **acknowledged**: Mark violation as acknowledged
    - **acknowledged_by**: Username of person who acknowledged
    - **notes**: Add notes about the violation
    
    **Permissions:**
    - Status updates require MANAGER or ADMIN role
    - Notes/corrective action updates require MANAGER or ADMIN role
    """
    # Check permissions based on what's being updated
    if violation.status and violation.status in ['closed', 'false_positive']:
        # Full status update requires MANAGER or ADMIN
        if not has_permission(current_user, Permission.VIOLATIONS_UPDATE_STATUS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update violation status"
            )
    elif violation.notes or violation.corrective_action:
        # Notes/corrective action updates require MANAGER or ADMIN
        if not has_permission(current_user, Permission.VIOLATIONS_UPDATE_NOTES):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update violation notes or corrective actions"
            )
    
    service = ViolationService(db)
    updated_violation = await service.update_violation(violation_id, violation)
    if not updated_violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation with id {violation_id} not found"
        )
    return updated_violation


@router.get("/{violation_id}/snapshot")
async def get_violation_snapshot(
    violation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Return stored snapshot image for a violation.
    """
    violation = await crud.get_violation_by_id(db, violation_id)
    if not violation or not violation.snapshot_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snapshot not found for this violation"
        )

    file_path = Path(violation.snapshot_path)
    if not file_path.is_absolute():
        file_path = settings.snapshots_dir / file_path

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Snapshot file is missing on the server"
        )

    return FileResponse(file_path, media_type="image/jpeg")


@router.post("/{violation_id}/acknowledge", response_model=schemas.ViolationResponse)
async def acknowledge_violation(
    violation_id: int,
    acknowledged_by: str = Query(..., description="Username of person acknowledging"),
    notes: Optional[str] = Query(None, description="Optional notes"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Acknowledge a violation (shortcut endpoint)
    
    This is a convenience endpoint equivalent to PUT with acknowledged=True
    
    **Permissions:**
    - OPERATOR, MANAGER, and ADMIN can acknowledge violations
    """
    if not has_permission(current_user, Permission.VIOLATIONS_ACKNOWLEDGE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to acknowledge violations"
        )
    
    service = ViolationService(db)
    updated_violation = await service.acknowledge_violation(
        violation_id,
        acknowledged_by,
        notes
    )
    if not updated_violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation with id {violation_id} not found"
        )
    return updated_violation

