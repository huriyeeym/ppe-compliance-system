"""
Violation API endpoints
Manage PPE violations with filtering and statistics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from backend.database.connection import get_db
from backend.database import crud, schemas
from backend.database.models import ViolationSeverity


router = APIRouter(prefix="/violations", tags=["Violations"])


@router.get("/", response_model=schemas.PaginatedResponse)
async def get_violations(
    domain_id: Optional[int] = Query(None, description="Filter by domain"),
    camera_id: Optional[int] = Query(None, description="Filter by camera"),
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledgment status"),
    severity: Optional[ViolationSeverity] = Query(None, description="Filter by severity"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of records"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get violations with filtering and pagination
    
    **Filters:**
    - **domain_id**: Show violations from specific domain
    - **camera_id**: Show violations from specific camera
    - **acknowledged**: Show acknowledged/unacknowledged violations
    - **severity**: Filter by severity (critical, high, medium, low)
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
        acknowledged=acknowledged,
        severity=severity,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit
    )
    
    violations, total = await crud.get_violations(db, filters)
    
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
    db: AsyncSession = Depends(get_db)
):
    """
    Get violation statistics
    
    Returns:
    - total_violations: Total number of violations
    - acknowledged: Number of acknowledged violations
    - pending: Number of pending violations
    """
    stats = await crud.get_violation_stats(db, domain_id, start_date, end_date)
    return stats


@router.get("/{violation_id}", response_model=schemas.ViolationResponse)
async def get_violation(
    violation_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific violation by ID
    """
    violation = await crud.get_violation_by_id(db, violation_id)
    if not violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation with id {violation_id} not found"
        )
    return violation


@router.post("/", response_model=schemas.ViolationResponse, status_code=status.HTTP_201_CREATED)
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
    # Validate camera exists
    camera = await crud.get_camera_by_id(db, violation.camera_id)
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Camera with id {violation.camera_id} not found"
        )
    
    # Validate domain exists
    domain = await crud.get_domain_by_id(db, violation.domain_id)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {violation.domain_id} not found"
        )
    
    return await crud.create_violation(db, violation)


@router.put("/{violation_id}", response_model=schemas.ViolationResponse)
async def update_violation(
    violation_id: int,
    violation: schemas.ViolationUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a violation (typically for acknowledgment)
    
    Common use case:
    - **acknowledged**: Mark violation as acknowledged
    - **acknowledged_by**: Username of person who acknowledged
    - **notes**: Add notes about the violation
    """
    updated_violation = await crud.update_violation(db, violation_id, violation)
    if not updated_violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation with id {violation_id} not found"
        )
    return updated_violation


@router.post("/{violation_id}/acknowledge", response_model=schemas.ViolationResponse)
async def acknowledge_violation(
    violation_id: int,
    acknowledged_by: str = Query(..., description="Username of person acknowledging"),
    notes: Optional[str] = Query(None, description="Optional notes"),
    db: AsyncSession = Depends(get_db)
):
    """
    Acknowledge a violation (shortcut endpoint)
    
    This is a convenience endpoint equivalent to PUT with acknowledged=True
    """
    update_data = schemas.ViolationUpdate(
        acknowledged=True,
        acknowledged_by=acknowledged_by,
        notes=notes
    )
    
    updated_violation = await crud.update_violation(db, violation_id, update_data)
    if not updated_violation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Violation with id {violation_id} not found"
        )
    return updated_violation

