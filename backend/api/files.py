"""
File serving endpoints for user photos and other static files
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
from pathlib import Path
from backend.config import settings
from backend.database.models import User
from backend.api.auth import get_current_user
from backend.utils.logger import logger

router = APIRouter(prefix="/files", tags=["Files"])


@router.get("/{file_path:path}")
async def serve_file(
    file_path: str,
    current_user: User = Depends(get_current_user)
):
    """
    Serve static files (user photos, violation snapshots, etc.)
    
    **Security:** Only authenticated users can access files
    """
    try:
        # Construct full file path
        # file_path format: "user_photos/22/photo.jpg" or "violations/123/snapshot.jpg"
        full_path = settings.data_dir / file_path
        
        # Security: Ensure file is within data directory (prevent path traversal)
        try:
            full_path.resolve().relative_to(settings.data_dir.resolve())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if file exists
        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
        
        # Determine content type based on file extension
        content_type = "application/octet-stream"
        if file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
            content_type = "image/jpeg"
        elif file_path.endswith('.png'):
            content_type = "image/png"
        elif file_path.endswith('.gif'):
            content_type = "image/gif"
        elif file_path.endswith('.webp'):
            content_type = "image/webp"
        
        return FileResponse(
            path=str(full_path),
            media_type=content_type,
            filename=full_path.name
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving file {file_path}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error serving file"
        )

