"""
Database Migration: Add user_domains association table
Creates the many-to-many relationship table between users and domains
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

        # Check if user_domains table exists
        result = await session.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_domains'")
        )
        table_exists = result.fetchone() is not None

        if not table_exists:
            logger.info("Creating user_domains association table...")
            try:
                await session.execute(text("""
                    CREATE TABLE user_domains (
                        user_id INTEGER NOT NULL,
                        domain_id INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (user_id, domain_id),
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
                    )
                """))
                await session.commit()
                logger.info("Successfully created user_domains table")
                changes_made = True
            except Exception as e:
                await session.rollback()
                logger.error(f"Error creating user_domains table: {e}")
                return False
        else:
            logger.info("user_domains table already exists")

        # Migrate existing domain_id to user_domains if needed
        if table_exists or changes_made:
            logger.info("Migrating existing user domain_id to user_domains...")
            try:
                # Get all users with domain_id
                result = await session.execute(
                    text("SELECT id, domain_id FROM users WHERE domain_id IS NOT NULL")
                )
                users_with_domain = result.fetchall()

                migrated_count = 0
                for user_id, domain_id in users_with_domain:
                    # Check if association already exists
                    check_result = await session.execute(
                        text("SELECT 1 FROM user_domains WHERE user_id = :user_id AND domain_id = :domain_id"),
                        {"user_id": user_id, "domain_id": domain_id}
                    )
                    if check_result.fetchone() is None:
                        await session.execute(
                            text("INSERT INTO user_domains (user_id, domain_id) VALUES (:user_id, :domain_id)"),
                            {"user_id": user_id, "domain_id": domain_id}
                        )
                        migrated_count += 1

                if migrated_count > 0:
                    await session.commit()
                    logger.info(f"Successfully migrated {migrated_count} user-domain associations")
                    changes_made = True
                else:
                    logger.info("No users to migrate (all associations already exist)")
            except Exception as e:
                await session.rollback()
                logger.error(f"Error migrating user domains: {e}")
                return False

        if not changes_made:
            logger.info("No changes needed - database is up to date")

        return True


async def main():
    """Main entry point for the migration script."""
    logger.info("=" * 60)
    logger.info("USER_DOMAINS TABLE MIGRATION")
    logger.info("=" * 60)

    success = await _run_migration()

    if success:
        logger.info("=" * 60)
        logger.info("Migration completed successfully!")
        logger.info("=" * 60)
    else:
        logger.error("=" * 60)
        logger.error("Migration failed!")
        logger.error("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

