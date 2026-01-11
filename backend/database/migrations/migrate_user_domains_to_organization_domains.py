"""
Migration script: Move user_domains to organization_domains

This script migrates existing user_domains associations to organization_domains.
For each organization, it collects all domains selected by users in that organization
and adds them to the organization_domains table.

Usage:
    python -m backend.database.migrations.migrate_user_domains_to_organization_domains
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.connection import AsyncSessionLocal, init_db
from backend.database.models import User, Organization, Domain, user_domains, organization_domains
from backend.utils.logger import logger


async def migrate_user_domains_to_organization_domains():
    """
    Migrate user_domains to organization_domains
    
    Logic:
    1. For each organization, find all users
    2. Collect all domains selected by users in that organization
    3. Add unique domains to organization_domains
    """
    async with AsyncSessionLocal() as db:
        try:
            logger.info("Starting migration: user_domains -> organization_domains")
            
            # Get all organizations
            result = await db.execute(select(Organization))
            organizations = result.scalars().all()
            
            logger.info(f"Found {len(organizations)} organizations")
            
            total_added = 0
            
            for org in organizations:
                logger.info(f"Processing organization: {org.name} (ID: {org.id})")
                
                # Get all users in this organization
                users_result = await db.execute(
                    select(User).where(User.organization_id == org.id)
                )
                users = users_result.scalars().all()
                
                if not users:
                    logger.info(f"  No users in organization {org.name}")
                    continue
                
                logger.info(f"  Found {len(users)} users")
                
                # Collect all domain IDs selected by users in this organization
                domain_ids = set()
                for user in users:
                    # Get user's domains from user_domains table
                    user_domains_result = await db.execute(
                        select(user_domains.c.domain_id)
                        .where(user_domains.c.user_id == user.id)
                    )
                    user_domain_ids = [row[0] for row in user_domains_result.all()]
                    domain_ids.update(user_domain_ids)
                
                logger.info(f"  Found {len(domain_ids)} unique domains selected by users")
                
                # Add each domain to organization_domains (if not already exists)
                for domain_id in domain_ids:
                    # Check if already exists
                    existing = await db.execute(
                        select(organization_domains)
                        .where(
                            and_(
                                organization_domains.c.organization_id == org.id,
                                organization_domains.c.domain_id == domain_id
                            )
                        )
                    )
                    if existing.first():
                        logger.debug(f"    Domain {domain_id} already in organization {org.name}")
                        continue
                    
                    # Verify domain exists
                    domain_result = await db.execute(
                        select(Domain).where(Domain.id == domain_id)
                    )
                    domain = domain_result.scalar_one_or_none()
                    if not domain:
                        logger.warning(f"    Domain {domain_id} not found, skipping")
                        continue
                    
                    # Add to organization_domains
                    await db.execute(
                        organization_domains.insert().values(
                            organization_id=org.id,
                            domain_id=domain_id,
                            created_by=None,  # Migration, no specific user
                            created_at=None  # Will use default
                        )
                    )
                    logger.info(f"    Added domain {domain.name} (ID: {domain_id}) to organization {org.name}")
                    total_added += 1
                
                await db.commit()
                logger.info(f"  Completed organization {org.name}")
            
            logger.info(f"Migration completed. Added {total_added} domain-organization associations.")
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}", exc_info=True)
            await db.rollback()
            raise


async def main():
    """Main entry point"""
    await init_db()
    await migrate_user_domains_to_organization_domains()
    logger.info("Migration script finished")


if __name__ == "__main__":
    asyncio.run(main())

