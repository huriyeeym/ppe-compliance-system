"""
Database migration: Add domain_id and permissions columns to users table
"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.config import settings
from backend.utils.logger import logger


async def _run_migration():
    """Internal function to run the migration."""
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        changes_made = False

        # Check if columns exist using PRAGMA
        result = await session.execute(text("PRAGMA table_info(users)"))
        columns = result.fetchall()
        column_names = [col[1] for col in columns]  # Column name is at index 1

        # Add domain_id column if it doesn't exist
        if "domain_id" not in column_names:
            logger.info("Adding domain_id column to users table...")
            try:
                await session.execute(text("ALTER TABLE users ADD COLUMN domain_id INTEGER NULL"))
                await session.execute(text("CREATE INDEX IF NOT EXISTS ix_users_domain_id ON users(domain_id)"))
                await session.commit()
                logger.info("Successfully added domain_id column")
                changes_made = True
            except Exception as e:
                await session.rollback()
                logger.error(f"Error adding domain_id column: {e}")
                return False

        # Add permissions column if it doesn't exist
        if "permissions" not in column_names:
            logger.info("Adding permissions column to users table...")
            try:
                await session.execute(text("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]' NOT NULL"))
                await session.commit()
                logger.info("Successfully added permissions column")
                changes_made = True
            except Exception as e:
                await session.rollback()
                logger.error(f"Error adding permissions column: {e}")
                return False

        # Verify migration
        result_after = await session.execute(text("PRAGMA table_info(users)"))
        columns_after = result_after.fetchall()
        column_names_after = [col[1] for col in columns_after]
        
        if "domain_id" in column_names_after and "permissions" in column_names_after:
            logger.info("Migration verified: domain_id and permissions columns exist")
            if not changes_made:
                logger.info("All columns already exist, no changes needed")
            return True
        else:
            logger.error("Migration failed: Some columns not found after alter")
            return False


def migrate_database():
    """Run the database migration to add domain_id and permissions columns."""
    return asyncio.run(_run_migration())


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Database Migration: Add user permissions columns")
    logger.info("=" * 60)

    success = migrate_database()

    if success:
        logger.info("Migration completed successfully!")
    else:
        logger.error("Migration failed.")
        sys.exit(1)

