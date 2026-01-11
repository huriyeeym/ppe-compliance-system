"""
Initialize database with seed data
Creates tables and loads initial data (domains, PPE types, rules, default camera)
"""

import sys
import asyncio
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.connection import engine, AsyncSessionLocal
from backend.database import models
from backend.database.seed_data import DOMAINS, PPE_TYPES, DOMAIN_PPE_RULES
from backend.utils.logger import logger
from backend.services.user_service import UserService


async def init_database():
    """Initialize database with all tables and seed data"""

    logger.info("=" * 60)
    logger.info("DATABASE INITIALIZATION")
    logger.info("=" * 60)

    # 1. Create all tables
    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    logger.info("Tables created successfully")

    # 2. Load seed data
    async with AsyncSessionLocal() as db:
        try:
            # Check if data already exists
            from sqlalchemy import select, delete
            result = await db.execute(select(models.Domain))
            existing_domains = len(result.scalars().all())

            if existing_domains > 0:
                logger.warning(f"Database already has {existing_domains} domains - CLEARING ALL DATA")
                # Clear existing data to reload with updated translations
                await db.execute(delete(models.DomainPPERule))
                await db.execute(delete(models.PPEType))
                await db.execute(delete(models.Camera))
                await db.execute(delete(models.Domain))
                await db.commit()
                logger.info("  Old data cleared, loading fresh English data...")

            # Load domains
            logger.info(f"Loading {len(DOMAINS)} domains...")
            for domain_data in DOMAINS:
                domain = models.Domain(**domain_data)
                db.add(domain)
            await db.commit()
            logger.info(f"  {len(DOMAINS)} domains loaded")

            # Load PPE types
            logger.info(f"Loading {len(PPE_TYPES)} PPE types...")
            for ppe_data in PPE_TYPES:
                ppe = models.PPEType(**ppe_data)
                db.add(ppe)
            await db.commit()
            logger.info(f"  {len(PPE_TYPES)} PPE types loaded")

            # Load domain PPE rules
            logger.info(f"Loading {len(DOMAIN_PPE_RULES)} domain rules...")
            for rule_data in DOMAIN_PPE_RULES:
                rule = models.DomainPPERule(**rule_data)
                db.add(rule)
            await db.commit()
            logger.info(f"  {len(DOMAIN_PPE_RULES)} domain rules loaded")

            # Add default camera (laptop webcam for construction domain)
            # Note: Camera creation temporarily disabled due to schema mismatch
            # logger.info("Adding default camera (laptop webcam)...")
            # default_camera = models.Camera(
            #     name="Laptop Camera",
            #     domain_id=1,  # Construction domain
            #     source_type=models.SourceType.WEBCAM,
            #     source_uri="0",  # Default webcam
            #     is_active=True,
            #     location="Test Location"
            # )
            # db.add(default_camera)
            # await db.commit()
            # logger.info("  Default camera added")

            logger.info("=" * 60)
            logger.info("DATABASE INITIALIZATION COMPLETE!")
            logger.info("=" * 60)

            # Print summary
            result = await db.execute(select(models.Domain))
            domains_count = len(result.scalars().all())

            result = await db.execute(
                select(models.Domain).where(models.Domain.status == models.DomainStatus.ACTIVE)
            )
            active_domains = len(result.scalars().all())

            result = await db.execute(select(models.PPEType))
            ppe_count = len(result.scalars().all())

            result = await db.execute(select(models.Camera))
            camera_count = len(result.scalars().all())

            logger.info("")
            logger.info("Summary:")
            logger.info(f"  Domains: {domains_count} ({active_domains} active)")
            logger.info(f"  PPE Types: {ppe_count}")
            logger.info(f"  Rules: {len(DOMAIN_PPE_RULES)}")
            logger.info(f"  Cameras: {camera_count}")
            logger.info("")
            # Ensure default admin user exists
            logger.info("Ensuring default admin user...")
            user_service = UserService(db)
            admin = await user_service.ensure_default_admin()
            logger.info(f"  Admin user: {admin.email} / admin123")

            logger.info("Next steps:")
            logger.info("  1. Start backend: python backend/main.py")
            logger.info("  2. Start frontend: cd frontend && npm run dev")
            logger.info("  3. Open http://localhost:5173")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"Database initialization failed: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(init_database())
