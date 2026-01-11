"""
Quick script to add Warehouse domain to database
Run this if Warehouse domain is missing
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.connection import AsyncSessionLocal
from backend.database.models import Domain, DomainStatus
from backend.database.seed import seed_domains
from backend.utils.logger import logger


async def main():
    """Add Warehouse domain if missing"""
    async with AsyncSessionLocal() as db:
        # Check if Warehouse exists
        from sqlalchemy import select
        result = await db.execute(
            select(Domain).where(Domain.type == "warehouse")
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            logger.info(f"Warehouse domain already exists (id={existing.id})")
            return
        
        # Create Warehouse domain
        warehouse = Domain(
            name="Warehouse",
            type="warehouse",
            icon="📦",
            description="Warehouses, storage facilities, logistics centers",
            status=DomainStatus.ACTIVE
        )
        db.add(warehouse)
        await db.commit()
        await db.refresh(warehouse)
        logger.info(f"Warehouse domain created successfully (id={warehouse.id})")


if __name__ == "__main__":
    asyncio.run(main())

