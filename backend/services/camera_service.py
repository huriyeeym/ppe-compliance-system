"""
Camera Service
Business logic layer for camera management
Follows SOLID principles and clean architecture
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import crud, schemas
from backend.database.models import Camera
from backend.utils.logger import logger


class CameraService:
    """
    Service class for camera business logic
    
    Responsibilities:
    - Validate camera data
    - Handle camera creation/update logic
    - Coordinate between API and database layers
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize camera service
        
        Args:
            db: Database session (dependency injection)
        """
        self.db = db
    
    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        domain_id: Optional[int] = None
    ) -> List[Camera]:
        """
        Get all cameras with optional domain filtering
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records
            domain_id: Optional domain filter
            
        Returns:
            List of cameras
        """
        logger.debug(f"Fetching cameras (skip={skip}, limit={limit}, domain_id={domain_id})")
        
        if domain_id:
            cameras = await crud.get_cameras_by_domain(self.db, domain_id)
        else:
            cameras = await crud.get_cameras(self.db, skip=skip, limit=limit)
        
        logger.info(f"Retrieved {len(cameras)} cameras")
        return cameras
    
    async def get_by_id(self, camera_id: int) -> Optional[Camera]:
        """
        Get camera by ID
        
        Args:
            camera_id: Camera ID
            
        Returns:
            Camera if found, None otherwise
        """
        logger.debug(f"Fetching camera {camera_id}")
        camera = await crud.get_camera_by_id(self.db, camera_id)
        if camera:
            logger.debug(f"Camera {camera_id} found: {camera.name}")
        else:
            logger.warning(f"Camera {camera_id} not found")
        return camera
    
    async def create(self, camera_data: schemas.CameraCreate) -> Camera:
        """
        Create a new camera
        
        Business logic:
        - Validate domain exists
        - Create camera record
        
        Args:
            camera_data: Camera creation data
            
        Returns:
            Created camera
            
        Raises:
            ValueError: If domain not found
        """
        logger.info(f"Creating camera: {camera_data.name}")
        
        # Validate domain exists
        domain = await crud.get_domain_by_id(self.db, camera_data.domain_id)
        if not domain:
            error_msg = f"Domain {camera_data.domain_id} not found"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Create camera
        camera = await crud.create_camera(self.db, camera_data)
        logger.info(f"Camera {camera.id} created successfully: {camera.name}")
        
        return camera
    
    async def update(
        self,
        camera_id: int,
        update_data: schemas.CameraUpdate
    ) -> Optional[Camera]:
        """
        Update a camera
        
        Args:
            camera_id: Camera ID
            update_data: Update data
            
        Returns:
            Updated camera if found, None otherwise
            
        Raises:
            ValueError: If domain_id is being updated and domain not found
        """
        logger.info(f"Updating camera {camera_id}")
        
        # If domain_id is being updated, validate it exists
        if update_data.domain_id:
            domain = await crud.get_domain_by_id(self.db, update_data.domain_id)
            if not domain:
                error_msg = f"Domain {update_data.domain_id} not found"
                logger.error(error_msg)
                raise ValueError(error_msg)
        
        camera = await crud.update_camera(self.db, camera_id, update_data)
        
        if camera:
            logger.info(f"Camera {camera_id} updated successfully")
        else:
            logger.warning(f"Camera {camera_id} not found for update")
        
        return camera
    
    async def delete(self, camera_id: int) -> bool:
        """
        Delete a camera
        
        Args:
            camera_id: Camera ID
            
        Returns:
            True if deleted, False if not found
        """
        logger.warning(f"Deleting camera {camera_id}")
        
        success = await crud.delete_camera(self.db, camera_id)
        
        if success:
            logger.info(f"Camera {camera_id} deleted successfully")
        else:
            logger.warning(f"Camera {camera_id} not found for deletion")
        
        return success

