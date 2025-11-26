"""
Violation Service
Business logic layer for violation management
Follows SOLID principles and clean architecture
"""

from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import crud, schemas
from backend.database.models import Violation, ViolationSeverity
from backend.utils.logger import logger
from backend.utils.snapshots import save_snapshot_image


class ViolationService:
    """
    Service class for violation business logic
    
    Responsibilities:
    - Validate violation data
    - Calculate severity
    - Handle violation creation/update logic
    - Coordinate between API and database layers
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize violation service
        
        Args:
            db: Database session (dependency injection)
        """
        self.db = db
    
    async def get_violations(
        self,
        filters: schemas.ViolationFilterParams
    ) -> Tuple[List[Violation], int]:
        """
        Get violations with filtering and pagination
        
        Args:
            filters: Filter parameters
            
        Returns:
            Tuple of (violations list, total count)
        """
        logger.debug(f"Fetching violations with filters: {filters}")
        violations, total = await crud.get_violations(self.db, filters)
        logger.info(f"Retrieved {len(violations)} violations (total: {total})")
        return violations, total
    
    async def get_violation_by_id(self, violation_id: int) -> Optional[Violation]:
        """
        Get violation by ID
        
        Args:
            violation_id: Violation ID
            
        Returns:
            Violation if found, None otherwise
        """
        logger.debug(f"Fetching violation {violation_id}")
        violation = await crud.get_violation_by_id(self.db, violation_id)
        if violation:
            logger.debug(f"Violation {violation_id} found")
        else:
            logger.warning(f"Violation {violation_id} not found")
        return violation
    
    async def create_violation(
        self,
        violation_data: schemas.ViolationCreate
    ) -> Violation:
        """
        Create a new violation
        
        Business logic:
        - Validate camera and domain exist
        - Calculate severity if not provided
        - Create violation record
        
        Args:
            violation_data: Violation creation data
            
        Returns:
            Created violation
            
        Raises:
            ValueError: If camera or domain not found
        """
        logger.info(f"Creating violation for camera {violation_data.camera_id}")
        
        # Validate camera exists
        camera = await crud.get_camera_by_id(self.db, violation_data.camera_id)
        if not camera:
            error_msg = f"Camera {violation_data.camera_id} not found"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Validate domain exists
        domain = await crud.get_domain_by_id(self.db, violation_data.domain_id)
        if not domain:
            error_msg = f"Domain {violation_data.domain_id} not found"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        # Calculate severity if not provided
        if not violation_data.severity:
            violation_data.severity = self._calculate_severity(
                violation_data.missing_ppe
            )
            logger.debug(f"Calculated severity: {violation_data.severity}")
        
        # Persist snapshot if provided
        if violation_data.frame_snapshot:
            snapshot_path = save_snapshot_image(violation_data.frame_snapshot)
            violation_data.snapshot_path = snapshot_path
            violation_data.frame_snapshot = None  # do not store base64 in DB

        # Create violation
        violation = await crud.create_violation(self.db, violation_data)
        logger.info(f"Violation {violation.id} created successfully")
        
        return violation
    
    async def update_violation(
        self,
        violation_id: int,
        update_data: schemas.ViolationUpdate
    ) -> Optional[Violation]:
        """
        Update a violation
        
        Args:
            violation_id: Violation ID
            update_data: Update data
            
        Returns:
            Updated violation if found, None otherwise
        """
        logger.info(f"Updating violation {violation_id}")
        
        violation = await crud.update_violation(
            self.db,
            violation_id,
            update_data
        )
        
        if violation:
            logger.info(f"Violation {violation_id} updated successfully")
        else:
            logger.warning(f"Violation {violation_id} not found for update")
        
        return violation
    
    async def acknowledge_violation(
        self,
        violation_id: int,
        acknowledged_by: str,
        notes: Optional[str] = None
    ) -> Optional[Violation]:
        """
        Acknowledge a violation
        
        Args:
            violation_id: Violation ID
            acknowledged_by: Username of person acknowledging
            notes: Optional notes
            
        Returns:
            Updated violation if found, None otherwise
        """
        logger.info(f"Acknowledging violation {violation_id} by {acknowledged_by}")
        
        update_data = schemas.ViolationUpdate(
            acknowledged=True,
            acknowledged_by=acknowledged_by,
            notes=notes
        )
        
        return await self.update_violation(violation_id, update_data)
    
    async def get_statistics(
        self,
        domain_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> dict:
        """
        Get violation statistics
        
        Args:
            domain_id: Optional domain filter
            start_date: Optional start date filter
            end_date: Optional end date filter
            
        Returns:
            Statistics dictionary
        """
        logger.debug(f"Fetching statistics for domain {domain_id}")
        stats = await crud.get_violation_stats(
            self.db,
            domain_id,
            start_date,
            end_date
        )
        logger.debug(f"Statistics retrieved: {stats}")
        return stats
    
    def _calculate_severity(
        self,
        missing_ppe: List[dict]
    ) -> ViolationSeverity:
        """
        Calculate violation severity based on missing PPE
        
        Business logic:
        - Critical: Required PPE missing or high priority missing
        - High: Multiple recommended PPE missing
        - Medium: Single recommended PPE missing
        - Low: No missing PPE (shouldn't happen, but handle gracefully)
        
        Args:
            missing_ppe: List of missing PPE items with required/priority flags
            
        Returns:
            Calculated severity level
        """
        if not missing_ppe:
            return ViolationSeverity.LOW
        
        # Check for required PPE
        has_required = any(
            item.get('required', False) for item in missing_ppe
        )
        
        # Check for high priority
        has_high_priority = any(
            item.get('priority', 3) == 1 for item in missing_ppe
        )
        
        if has_required or has_high_priority:
            return ViolationSeverity.CRITICAL
        
        # Multiple missing items
        if len(missing_ppe) >= 2:
            return ViolationSeverity.HIGH
        
        # Single missing item
        return ViolationSeverity.MEDIUM

