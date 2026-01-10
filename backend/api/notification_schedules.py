"""
Notification Schedules API
Endpoints for managing email notification schedules
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

from backend.database.connection import get_db
from backend.database.models import NotificationSchedule, ScheduleType
from backend.services.scheduler_service import get_scheduler_service
from backend.utils.logger import logger


router = APIRouter(prefix="/api/notification-schedules", tags=["Notification Schedules"])


# ==========================================
# PYDANTIC MODELS
# ==========================================

class NotificationScheduleCreate(BaseModel):
    """Request model for creating notification schedule"""
    type: ScheduleType
    enabled: bool = True
    schedule_time: Optional[str] = None  # "18:00"
    schedule_day: Optional[str] = None  # "Monday"
    recipients: List[str] = Field(default_factory=list)
    settings: Optional[Dict[str, Any]] = None


class NotificationScheduleUpdate(BaseModel):
    """Request model for updating notification schedule"""
    enabled: Optional[bool] = None
    schedule_time: Optional[str] = None
    schedule_day: Optional[str] = None
    recipients: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None


class NotificationScheduleResponse(BaseModel):
    """Response model for notification schedule"""
    id: int
    type: str
    enabled: bool
    schedule_time: Optional[str]
    schedule_day: Optional[str]
    recipients: List[str]
    settings: Dict[str, Any]
    created_at: str
    updated_at: str
    last_run_at: Optional[str]

    class Config:
        from_attributes = True


# ==========================================
# ENDPOINTS
# ==========================================

@router.get("", response_model=List[NotificationScheduleResponse])
async def get_notification_schedules(
    db: AsyncSession = Depends(get_db)
):
    """Get all notification schedules"""
    try:
        result = await db.execute(select(NotificationSchedule))
        schedules = result.scalars().all()

        return [
            NotificationScheduleResponse(
                **schedule.to_dict()
            ) for schedule in schedules
        ]

    except Exception as e:
        logger.error(f"Error getting notification schedules: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification schedules: {str(e)}"
        )


@router.get("/{schedule_id}", response_model=NotificationScheduleResponse)
async def get_notification_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get single notification schedule by ID"""
    try:
        result = await db.execute(
            select(NotificationSchedule).where(NotificationSchedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification schedule {schedule_id} not found"
            )

        return NotificationScheduleResponse(**schedule.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting notification schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get notification schedule: {str(e)}"
        )


@router.post("", response_model=NotificationScheduleResponse)
async def create_notification_schedule(
    schedule_data: NotificationScheduleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new notification schedule"""
    try:
        # Validate schedule data based on type
        if schedule_data.type in [ScheduleType.DAILY_SUMMARY, ScheduleType.WORKER_REMINDER]:
            if not schedule_data.schedule_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="schedule_time is required for this schedule type"
                )

        if schedule_data.type == ScheduleType.WORKER_REMINDER:
            if not schedule_data.schedule_day:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="schedule_day is required for worker reminders"
                )

        # Create schedule
        schedule = NotificationSchedule(
            type=schedule_data.type,
            enabled=schedule_data.enabled,
            schedule_time=schedule_data.schedule_time,
            schedule_day=schedule_data.schedule_day,
            recipients=schedule_data.recipients,
            settings=schedule_data.settings or {}
        )

        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)

        # Reload scheduler to pick up new schedule
        scheduler = get_scheduler_service()
        await scheduler.reload_schedules()

        logger.info(f"Created notification schedule: {schedule.type.value}")

        return NotificationScheduleResponse(**schedule.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating notification schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create notification schedule: {str(e)}"
        )


@router.put("/{schedule_id}", response_model=NotificationScheduleResponse)
async def update_notification_schedule(
    schedule_id: int,
    schedule_data: NotificationScheduleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update notification schedule"""
    try:
        result = await db.execute(
            select(NotificationSchedule).where(NotificationSchedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification schedule {schedule_id} not found"
            )

        # Update fields if provided
        if schedule_data.enabled is not None:
            schedule.enabled = schedule_data.enabled

        if schedule_data.schedule_time is not None:
            schedule.schedule_time = schedule_data.schedule_time

        if schedule_data.schedule_day is not None:
            schedule.schedule_day = schedule_data.schedule_day

        if schedule_data.recipients is not None:
            schedule.recipients = schedule_data.recipients

        if schedule_data.settings is not None:
            schedule.settings = schedule_data.settings

        await db.commit()
        await db.refresh(schedule)

        # Reload scheduler to pick up changes
        scheduler = get_scheduler_service()
        await scheduler.reload_schedules()

        logger.info(f"Updated notification schedule {schedule_id}")

        return NotificationScheduleResponse(**schedule.to_dict())

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating notification schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update notification schedule: {str(e)}"
        )


@router.delete("/{schedule_id}")
async def delete_notification_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete notification schedule"""
    try:
        result = await db.execute(
            select(NotificationSchedule).where(NotificationSchedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification schedule {schedule_id} not found"
            )

        await db.delete(schedule)
        await db.commit()

        # Reload scheduler to remove deleted schedule
        scheduler = get_scheduler_service()
        await scheduler.reload_schedules()

        logger.info(f"Deleted notification schedule {schedule_id}")

        return {"message": "Schedule deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting notification schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete notification schedule: {str(e)}"
        )


@router.post("/{schedule_id}/test")
async def test_notification_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger a notification schedule for testing"""
    try:
        result = await db.execute(
            select(NotificationSchedule).where(NotificationSchedule.id == schedule_id)
        )
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Notification schedule {schedule_id} not found"
            )

        # Trigger the job manually
        scheduler = get_scheduler_service()
        await scheduler.trigger_job_manually(schedule.type)

        logger.info(f"Manually triggered notification schedule {schedule_id}")

        return {
            "message": f"Test notification sent for {schedule.type.value}",
            "schedule_type": schedule.type.value
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing notification schedule: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test notification schedule: {str(e)}"
        )
