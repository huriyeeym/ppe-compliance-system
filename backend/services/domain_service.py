"""
Domain Service
Business logic layer for domain management
Follows SOLID principles and clean architecture
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import crud, schemas
from backend.database.models import Domain
from backend.utils.logger import logger


class DomainService:
    """
    Service class for domain business logic
    
    Responsibilities:
    - Validate domain data
    - Handle domain creation/update logic
    - Coordinate between API and database layers
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize domain service
        
        Args:
            db: Database session (dependency injection)
        """
        self.db = db
    
    async def get_all(self, skip: int = 0, limit: int = 100) -> List[Domain]:
        """
        Get all domains with pagination
        
        Args:
            skip: Number of records to skip
            limit: Maximum number of records
            
        Returns:
            List of domains
        """
        logger.debug(f"Fetching domains (skip={skip}, limit={limit})")
        domains = await crud.get_domains(self.db, skip=skip, limit=limit)
        logger.info(f"Retrieved {len(domains)} domains")
        return domains
    
    async def get_by_id(self, domain_id: int) -> Optional[Domain]:
        """
        Get domain by ID
        
        Args:
            domain_id: Domain ID
            
        Returns:
            Domain if found, None otherwise
        """
        logger.debug(f"Fetching domain {domain_id}")
        domain = await crud.get_domain_by_id(self.db, domain_id)
        if domain:
            logger.debug(f"Domain {domain_id} found: {domain.name}")
        else:
            logger.warning(f"Domain {domain_id} not found")
        return domain
    
    async def get_by_type(self, domain_type: str) -> Optional[Domain]:
        """
        Get domain by type (e.g., 'construction')
        
        Args:
            domain_type: Domain type identifier
            
        Returns:
            Domain if found, None otherwise
        """
        logger.debug(f"Fetching domain by type: {domain_type}")
        domain = await crud.get_domain_by_type(self.db, domain_type)
        if domain:
            logger.debug(f"Domain found: {domain.name} (id={domain.id})")
        else:
            logger.warning(f"Domain type '{domain_type}' not found")
        return domain
    
    async def create(self, domain_data: schemas.DomainCreate) -> Domain:
        """
        Create a new domain
        
        Business logic:
        - Validate type doesn't already exist
        - Create domain record
        
        Args:
            domain_data: Domain creation data
            
        Returns:
            Created domain
            
        Raises:
            ValueError: If domain type already exists
        """
        logger.info(f"Creating domain: {domain_data.name} (type: {domain_data.type})")
        
        # Validate type doesn't exist
        existing = await crud.get_domain_by_type(self.db, domain_data.type)
        if existing:
            error_msg = f"Domain with type '{domain_data.type}' already exists"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Create domain
        domain = await crud.create_domain(self.db, domain_data)
        logger.info(f"Domain {domain.id} created successfully: {domain.name}")
        
        return domain
    
    async def update(
        self,
        domain_id: int,
        update_data: schemas.DomainUpdate
    ) -> Optional[Domain]:
        """
        Update a domain
        
        Args:
            domain_id: Domain ID
            update_data: Update data
            
        Returns:
            Updated domain if found, None otherwise
        """
        logger.info(f"Updating domain {domain_id}")
        
        domain = await crud.update_domain(self.db, domain_id, update_data)
        
        if domain:
            logger.info(f"Domain {domain_id} updated successfully")
        else:
            logger.warning(f"Domain {domain_id} not found for update")
        
        return domain
    
    async def delete(self, domain_id: int) -> bool:
        """
        Delete a domain
        
        Args:
            domain_id: Domain ID
            
        Returns:
            True if deleted, False if not found
        """
        logger.warning(f"Deleting domain {domain_id}")
        
        success = await crud.delete_domain(self.db, domain_id)
        
        if success:
            logger.info(f"Domain {domain_id} deleted successfully")
        else:
            logger.warning(f"Domain {domain_id} not found for deletion")
        
        return success
    
    async def get_rules(self, domain_id: int) -> List:
        """
        Get all PPE rules for a domain
        
        Args:
            domain_id: Domain ID
            
        Returns:
            List of domain PPE rules
        """
        logger.debug(f"Fetching rules for domain {domain_id}")
        rules = await crud.get_domain_rules(self.db, domain_id)
        logger.debug(f"Retrieved {len(rules)} rules for domain {domain_id}")
        return rules

