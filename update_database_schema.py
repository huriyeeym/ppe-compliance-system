"""
Database Schema Update Script
Backs up current database and creates new schema with duration_seconds field
"""

import asyncio
import shutil
from pathlib import Path
from datetime import datetime

from backend.database.connection import init_db
from backend.utils.logger import logger


async def update_database_schema():
    """Update database schema with new fields"""

    db_path = Path("data/ppe_compliance.db")

    # Backup existing database
    if db_path.exists():
        backup_name = f"data/ppe_compliance.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        logger.info(f"Backing up existing database to {backup_name}")
        shutil.copy(db_path, backup_name)

        # Remove old database
        logger.info("Removing old database...")
        db_path.unlink()

    # Create new database with updated schema
    logger.info("Creating new database with updated schema...")
    await init_db()

    logger.info("✅ Database schema updated successfully!")
    logger.info("⚠️  Note: All existing data has been backed up but needs to be migrated manually if needed.")
    logger.info("    The new database starts empty with the new schema including 'duration_seconds' field.")


if __name__ == "__main__":
    asyncio.run(update_database_schema())
