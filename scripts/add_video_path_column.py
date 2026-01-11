"""
Database Migration: Add video_path column to violations table
Run this script to add the video_path column to existing databases
"""

import sqlite3
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import settings
from backend.utils.logger import logger


def migrate_database():
    """Add video_path column to violations table"""
    
    db_path = settings.data_dir / "ppe_compliance.db"
    
    if not db_path.exists():
        logger.error(f"Database not found: {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if column already exists
        cursor.execute("PRAGMA table_info(violations)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "video_path" in columns:
            logger.info("Column 'video_path' already exists in violations table")
            return True
        
        # Add video_path column
        logger.info("Adding video_path column to violations table...")
        cursor.execute("""
            ALTER TABLE violations 
            ADD COLUMN video_path VARCHAR(300) NULL
        """)
        
        conn.commit()
        logger.info("Successfully added video_path column")
        
        # Verify
        cursor.execute("PRAGMA table_info(violations)")
        columns = [row[1] for row in cursor.fetchall()]
        if "video_path" in columns:
            logger.info("Migration verified: video_path column exists")
            return True
        else:
            logger.error("Migration failed: video_path column not found")
            return False
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        return False
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration: Add video_path column")
    print("=" * 60)
    print()
    
    success = migrate_database()
    
    if success:
        print("\n[SUCCESS] Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n[ERROR] Migration failed!")
        sys.exit(1)

