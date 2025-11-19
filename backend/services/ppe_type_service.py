"""
PPE Type Service
Business logic layer for PPE type management
Follows SOLID principles and clean architecture
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import crud, schemas
from backend.database.models import PPEType
from backend.utils.logger import logger


class PPETypeService:
    """
    Service class for PPE type business logic
    
    Responsibilities:
    - Validate PPE type data
    - Handle PPE type creation/update logic
    - Coordinate between API and database layers
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize PPE type service
        
        Args:
            db: Database session (dependency injection)
        """
        self.db = db
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[PPEType]:
        """
        Get all PPE types with pagination
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records
            
        Returns:
            List of PPE types
        """
        logger.debug(f"Fetching PPE types (skip={skip}, limit={limit})")
        ppe_types = await crud.get_ppe_types(self.db, skip=skip, limit=limit)
        logger.info(f"Retrieved {len(ppe_types)} PPE types")
        return ppe_types
    
    async def get_by_id(self, ppe_type_id: int) -> Optional[PPEType]:
        """
        Get PPE type by ID
        
        Args:
            ppe_type_id: PPE type ID
            
        Returns:
            PPE type if found, None otherwise
        """
        logger.debug(f"Fetching PPE type {ppe_type_id}")
        ppe_type = await crud.get_ppe_type_by_id(self.db, ppe_type_id)
        if ppe_type:
            logger.debug(f"PPE type {ppe_type_id} found: {ppe_type.display_name}")
        else:
            logger.warning(f"PPE type {ppe_type_id} not found")
        return ppe_type
    
    async def create(self, ppe_type_data: schemas.PPETypeCreate) -> PPEType:
        """
        Create a new PPE type
        
        Args:
            ppe_type_data: PPE type creation data
            
        Returns:
            Created PPE type
        """
        logger.info(f"Creating PPE type: {ppe_type_data.display_name}")
        
        ppe_type = await crud.create_ppe_type(self.db, ppe_type_data)
        logger.info(f"PPE type {ppe_type.id} created successfully: {ppe_type.display_name}")
        
        return ppe_type
    
    async def update(
        self,
        ppe_type_id: int,
        update_data: schemas.PPETypeUpdate
    ) -> Optional[PPEType]:
        """
        Update a PPE type
        
        Args:
            ppe_type_id: PPE type ID
            update_data: Update data
            
        Returns:
            Updated PPE type if found, None otherwise
        """
        logger.info(f"Updating PPE type {ppe_type_id}")
        
        ppe_type = await crud.update_ppe_type(self.db, ppe_type_id, update_data)
        
        if ppe_type:
            logger.info(f"PPE type {ppe_type_id} updated successfully")
        else:
            logger.warning(f"PPE type {ppe_type_id} not found for update")
        
        return ppe_type
    
    async def delete(self, ppe_type_id: int) -> bool:
        """
        Delete a PPE type
        
        Args:
            ppe_type_id: PPE type ID
            
        Returns:
            True if deleted, False if not found
        """
        logger.warning(f"Deleting PPE type {ppe_type_id}")
        
        success = await crud.delete_ppe_type(self.db, ppe_type_id)
        
        if success:
            logger.info(f"PPE type {ppe_type_id} deleted successfully")
        else:
            logger.warning(f"PPE type {ppe_type_id} not found for deletion")
        
        return success

