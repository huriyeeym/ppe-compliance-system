"""
Database Migration: Add face recognition support
- Creates user_photos table
- Adds detected_user_id and face_match_confidence columns to violations table
"""

import asyncio
import sys
import json
from pathlib import Path
from sqlalchemy import text, inspect
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.config import settings
from backend.utils.logger import logger


async def _run_migration():
    """Internal function to run the migration."""
    # #region agent log
    import json
    log_path = Path(__file__).parent.parent.parent.parent / ".cursor" / "debug.log"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId":"debug-session","runId":"migration-check","hypothesisId":"A","location":"add_face_recognition_tables.py:21","message":"Starting migration","data":{"database_url":str(settings.database_url)},"timestamp":int(__import__("time").time()*1000)})+"\n")
    # #endregion
    
    engine = create_async_engine(settings.database_url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # #region agent log
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"migration-check","hypothesisId":"B","location":"add_face_recognition_tables.py:27","message":"Session created, checking existing tables","data":{},"timestamp":int(__import__("time").time()*1000)})+"\n")
        # #endregion
        
        changes_made = False
        
        # Check if violations table exists
        # #region agent log
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"migration-check","hypothesisId":"C","location":"add_face_recognition_tables.py:32","message":"Checking violations table existence","data":{},"timestamp":int(__import__("time").time()*1000)})+"\n")
        # #endregion
        
        try:
            result = await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='violations'")
            )
            violations_exists = result.fetchone() is not None
            
            # #region agent log
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"migration-check","hypothesisId":"C","location":"add_face_recognition_tables.py:40","message":"Violations table check result","data":{"violations_exists":violations_exists},"timestamp":int(__import__("time").time()*1000)})+"\n")
            # #endregion
            
            if not violations_exists:
                logger.warning("WARNING: violations table does not exist. Please run database initialization first:")
                logger.warning("   python scripts/init_database.py")
                logger.warning("   OR start the backend server (it will auto-initialize)")
                # #region agent log
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"sessionId":"debug-session","runId":"migration-check","hypothesisId":"C","location":"add_face_recognition_tables.py:47","message":"Violations table missing - migration cannot proceed","data":{},"timestamp":int(__import__("time").time()*1000)})+"\n")
                # #endregion
                return False
        except Exception as e:
            # #region agent log
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"migration-check","hypothesisId":"D","location":"add_face_recognition_tables.py:52","message":"Error checking violations table","data":{"error":str(e)},"timestamp":int(__import__("time").time()*1000)})+"\n")
            # #endregion
            logger.error(f"Error checking violations table: {e}")
            return False

        # 1. Create user_photos table if it doesn't exist
        try:
            # Check if table exists
            result = await session.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_photos'")
            )
            table_exists = result.fetchone() is not None

            if not table_exists:
                logger.info("Creating user_photos table...")
                await session.execute(text("""
                    CREATE TABLE user_photos (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        photo_path VARCHAR(300) NOT NULL,
                        face_encoding TEXT,
                        is_primary BOOLEAN DEFAULT 0,
                        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        uploaded_by INTEGER,
                        FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
                        FOREIGN KEY(uploaded_by) REFERENCES users (id)
                    )
                """))
                await session.execute(text("CREATE INDEX IF NOT EXISTS ix_user_photos_user_id ON user_photos(user_id)"))
                await session.commit()
                logger.info("Successfully created user_photos table")
                changes_made = True
            else:
                logger.info("user_photos table already exists")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error creating user_photos table: {e}")
            return False

        # 2. Add detected_user_id column to violations table if it doesn't exist
        try:
            result = await session.execute(text("PRAGMA table_info(violations)"))
            columns = result.fetchall()
            column_names = [col[1] for col in columns]

            if "detected_user_id" not in column_names:
                logger.info("Adding detected_user_id column to violations table...")
                await session.execute(text("ALTER TABLE violations ADD COLUMN detected_user_id INTEGER"))
                await session.execute(text("CREATE INDEX IF NOT EXISTS ix_violations_detected_user_id ON violations(detected_user_id)"))
                await session.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_violations_detected_user_id 
                    ON violations(detected_user_id)
                """))
                await session.commit()
                logger.info("Successfully added detected_user_id column")
                changes_made = True
            else:
                logger.info("detected_user_id column already exists")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error adding detected_user_id column: {e}")
            return False

        # 3. Add face_match_confidence column to violations table if it doesn't exist
        try:
            result = await session.execute(text("PRAGMA table_info(violations)"))
            columns = result.fetchall()
            column_names = [col[1] for col in columns]

            if "face_match_confidence" not in column_names:
                logger.info("Adding face_match_confidence column to violations table...")
                await session.execute(text("ALTER TABLE violations ADD COLUMN face_match_confidence REAL"))
                await session.commit()
                logger.info("Successfully added face_match_confidence column")
                changes_made = True
            else:
                logger.info("face_match_confidence column already exists")
        except Exception as e:
            await session.rollback()
            logger.error(f"Error adding face_match_confidence column: {e}")
            return False

        if changes_made:
            logger.info("[SUCCESS] Migration completed successfully!")
        else:
            logger.info("[SUCCESS] All changes already applied - no migration needed")

        return True


async def run_migration():
    """Run the migration."""
    logger.info("=" * 60)
    logger.info("FACE RECOGNITION MIGRATION")
    logger.info("=" * 60)
    
    success = await _run_migration()
    
    if success:
        logger.info("Migration completed successfully!")
    else:
        logger.error("Migration failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_migration())

