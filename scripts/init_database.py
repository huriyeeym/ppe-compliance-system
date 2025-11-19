"""
Database initialization script
Creates tables and loads seed data

Usage:
    python scripts/init_database.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.connection import init_db, AsyncSessionLocal
from backend.database.models import Domain, PPEType, DomainPPERule
from backend.database.seed_data import DOMAINS, PPE_TYPES, DOMAIN_PPE_RULES
from backend.utils.logger import logger


async def load_seed_data():
    """Load seed data into database"""
    logger.info("Loading seed data...")
    
    async with AsyncSessionLocal() as session:
        # Check if data already exists
        from sqlalchemy import select
        result = await session.execute(select(Domain))
        existing_domains = result.scalars().all()
        
        if existing_domains:
            logger.warning("Seed data already loaded. Skipping...")
            return
        
        # Load Domains
        logger.info("Loading domains...")
        for domain_data in DOMAINS:
            domain = Domain(**domain_data)
            session.add(domain)
        await session.commit()
        logger.info(f"{len(DOMAINS)} domains loaded")
        
        # Load PPE Types
        logger.info("Loading PPE types...")
        for ppe_data in PPE_TYPES:
            ppe_type = PPEType(**ppe_data)
            session.add(ppe_type)
        await session.commit()
        logger.info(f"{len(PPE_TYPES)} PPE types loaded")
        
        # Load Domain PPE Rules
        logger.info("Loading domain PPE rules...")
        for rule_data in DOMAIN_PPE_RULES:
            rule = DomainPPERule(**rule_data)
            session.add(rule)
        await session.commit()
        logger.info(f"{len(DOMAIN_PPE_RULES)} domain rules loaded")


async def main():
    """Main initialization function"""
    logger.info("=" * 60)
    logger.info("PPE Compliance System - Database Initialization")
    logger.info("=" * 60)
    
    # Create tables
    logger.info("Creating database tables...")
    await init_db()
    
    # Load seed data
    await load_seed_data()
    
    # Summary
    logger.info("=" * 60)
    logger.info("Database initialization complete!")
    logger.info("=" * 60)
    logger.info("Summary:")
    logger.info(f"  * Database: data/ppe_compliance.db")
    logger.info(f"  * Domains: {len(DOMAINS)} ({sum(1 for d in DOMAINS if d['status'].value == 'active')} active)")
    logger.info(f"  * PPE Types: {len(PPE_TYPES)}")
    logger.info(f"  * Rules: {len(DOMAIN_PPE_RULES)}")
    logger.info("You can now start the backend:")
    logger.info("   uvicorn backend.main:app --reload")


if __name__ == "__main__":
    asyncio.run(main())

