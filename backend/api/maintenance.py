"""
Maintenance API endpoints
For system maintenance tasks like cleanup, health checks, etc.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.connection import get_db
from backend.utils.snapshots import SnapshotManager
from backend.utils.video_recorder import VideoRecorder
from backend.utils.logger import logger

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.post("/cleanup/snapshots")
async def cleanup_snapshots(
    days_to_keep: int = 30,
    db: AsyncSession = Depends(get_db)
):
    """
    Cleanup old snapshots
    
    Args:
        days_to_keep: Number of days to retain snapshots (default: 30)
    
    Returns:
        Number of snapshots deleted
    """
    try:
        snapshot_mgr = SnapshotManager()
        deleted_count = snapshot_mgr.cleanup_old_snapshots(days_to_keep=days_to_keep)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "days_to_keep": days_to_keep,
            "message": f"Deleted {deleted_count} old snapshots"
        }
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup/videos")
async def cleanup_videos(
    days_to_keep: int = 30,
    db: AsyncSession = Depends(get_db)
):
    """
    Cleanup old video segments
    
    Args:
        days_to_keep: Number of days to retain videos (default: 30)
    
    Returns:
        Number of videos deleted
    """
    try:
        video_recorder = VideoRecorder()
        deleted_count = video_recorder.cleanup_old_videos(days_to_keep=days_to_keep)
        
        return {
            "success": True,
            "deleted_count": deleted_count,
            "days_to_keep": days_to_keep,
            "message": f"Deleted {deleted_count} old videos"
        }
    except Exception as e:
        logger.error(f"Video cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup/all")
async def cleanup_all(
    days_to_keep: int = 30,
    db: AsyncSession = Depends(get_db)
):
    """
    Cleanup both snapshots and videos
    
    Args:
        days_to_keep: Number of days to retain files (default: 30)
    
    Returns:
        Summary of cleanup operations
    """
    try:
        snapshot_mgr = SnapshotManager()
        video_recorder = VideoRecorder()
        
        snapshots_deleted = snapshot_mgr.cleanup_old_snapshots(days_to_keep=days_to_keep)
        videos_deleted = video_recorder.cleanup_old_videos(days_to_keep=days_to_keep)
        
        return {
            "success": True,
            "snapshots_deleted": snapshots_deleted,
            "videos_deleted": videos_deleted,
            "total_deleted": snapshots_deleted + videos_deleted,
            "days_to_keep": days_to_keep,
            "message": f"Deleted {snapshots_deleted} snapshots and {videos_deleted} videos"
        }
    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_storage_stats(db: AsyncSession = Depends(get_db)):
    """
    Get storage statistics for snapshots and videos
    
    Returns:
        Storage statistics
    """
    try:
        snapshot_mgr = SnapshotManager()
        video_recorder = VideoRecorder()
        
        snapshot_stats = snapshot_mgr.get_stats()
        video_stats = video_recorder.get_stats()
        
        return {
            "snapshots": snapshot_stats,
            "videos": video_stats,
            "total_size_mb": snapshot_stats["total_size_mb"] + video_stats["total_size_mb"]
        }
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

