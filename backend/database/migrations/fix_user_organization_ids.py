"""
Migration script: Fix user organization_id assignments

This script ensures all users have a valid organization_id.
For users without organization_id, it assigns them based on:
1. Email domain matching
2. Default organization (ID=1)
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.database.connection import AsyncSessionLocal, init_db
from backend.database.models import User
from backend.database import crud
from sqlalchemy import select, update
from backend.utils.logger import logger


async def fix_user_organization_ids():
    """
    Fix user organization_id assignments
    
    Logic:
    1. Find all users with null or invalid organization_id
    2. Try to assign based on email domain
    3. If no match, assign to default organization (ID=1)
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting migration: Fix user organization_id assignments")
            
            # Get all users
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            logger.info(f"Found {len(users)} total users")
            
            fixed_count = 0
            
            for user in users:
                # Check if user has organization_id
                if user.organization_id is None or user.organization_id == 0:
                    logger.info(f"User {user.id} ({user.email}) has no organization_id, fixing...")
                    
                    # Try to find organization by email domain
                    org = await crud.get_organization_by_email_domain(db, user.email)
                    if org:
                        user.organization_id = org.id
                        logger.info(f"  Assigned to organization: {org.name} (ID: {org.id})")
                    else:
                        # Assign to default organization (ID=1)
                        user.organization_id = 1
                        logger.info(f"  Assigned to default organization (ID: 1)")
                    
                    fixed_count += 1
                else:
                    # Verify organization exists
                    org = await crud.get_organization_by_id(db, user.organization_id)
                    if not org:
                        logger.warning(f"User {user.id} has invalid organization_id {user.organization_id}, fixing...")
                        # Try to find by email domain
                        org = await crud.get_organization_by_email_domain(db, user.email)
                        if org:
                            user.organization_id = org.id
                            logger.info(f"  Reassigned to organization: {org.name} (ID: {org.id})")
                        else:
                            user.organization_id = 1
                            logger.info(f"  Reassigned to default organization (ID: 1)")
                        fixed_count += 1
            
            if fixed_count > 0:
                await db.commit()
                logger.info(f"Migration completed. Fixed {fixed_count} users.")
            else:
                logger.info("No users needed fixing. All users have valid organization_id.")
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}", exc_info=True)
            await db.rollback()
            raise


async def main():
    """Main entry point"""
    await init_db()
    await fix_user_organization_ids()
    logger.info("Migration script finished")


if __name__ == "__main__":
    asyncio.run(main())

