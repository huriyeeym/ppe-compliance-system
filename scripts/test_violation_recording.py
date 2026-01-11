"""
Test script to verify violation recording is working
"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.connection import AsyncSessionLocal
from backend.database import crud, schemas
from backend.utils.logger import logger
import sqlite3


async def check_violations():
    """Check if violations exist in database"""
    logger.info("Checking violations in database...")
    
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from backend.database.models import Violation
        
        result = await session.execute(
            select(Violation).order_by(Violation.created_at.desc()).limit(100)
        )
        violations = result.scalars().all()
        logger.info(f"Found {len(violations)} violations in database")
        
        if len(violations) > 0:
            logger.info("Recent violations:")
            for v in violations[:5]:  # Show first 5
                logger.info(f"  - Violation ID: {v.id}, Camera: {v.camera_id}, "
                          f"Domain: {v.domain_id}, Severity: {v.severity}, "
                          f"Created: {v.created_at}")
        else:
            logger.warning("No violations found in database!")
            logger.info("This could mean:")
            logger.info("  1. No violations have been detected yet")
            logger.info("  2. Backend is not running")
            logger.info("  3. Violation recording is not working")
            logger.info("  4. Camera/domain IDs are not being sent from frontend")


def check_database_directly():
    """Check database directly using SQLite"""
    logger.info("Checking database directly...")
    
    db_path = project_root / "data" / "ppe_compliance.db"
    if not db_path.exists():
        logger.error(f"Database file not found: {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Check violations
    cursor.execute("SELECT COUNT(*) FROM violations")
    violation_count = cursor.fetchone()[0]
    logger.info(f"Total violations in database: {violation_count}")
    
    if violation_count > 0:
        cursor.execute("""
            SELECT id, camera_id, domain_id, severity, created_at, track_id
            FROM violations
            ORDER BY created_at DESC
            LIMIT 5
        """)
        violations = cursor.fetchall()
        logger.info("Recent violations:")
        for v in violations:
            logger.info(f"  - ID: {v[0]}, Camera: {v[1]}, Domain: {v[2]}, "
                      f"Severity: {v[3]}, Created: {v[4]}, Track: {v[5]}")
    else:
        logger.warning("No violations in database!")
    
    # Check cameras
    cursor.execute("SELECT id, name, domain_id, is_active FROM cameras")
    cameras = cursor.fetchall()
    logger.info(f"\nCameras in database: {len(cameras)}")
    for cam in cameras:
        logger.info(f"  - ID: {cam[0]}, Name: {cam[1]}, Domain: {cam[2]}, Active: {cam[3]}")
    
    # Check domains
    cursor.execute("SELECT id, name, type, status FROM domains")
    domains = cursor.fetchall()
    logger.info(f"\nDomains in database: {len(domains)}")
    for dom in domains:
        logger.info(f"  - ID: {dom[0]}, Name: {dom[1]}, Type: {dom[2]}, Status: {dom[3]}")
    
    conn.close()


async def main():
    """Main test function"""
    logger.info("=" * 60)
    logger.info("Violation Recording Test")
    logger.info("=" * 60)
    
    # Check database directly
    check_database_directly()
    
    # Check via ORM
    logger.info("\n" + "=" * 60)
    await check_violations()
    
    logger.info("\n" + "=" * 60)
    logger.info("Test completed!")
    logger.info("=" * 60)
    logger.info("\nTroubleshooting steps:")
    logger.info("1. Make sure backend is running: uvicorn backend.main:app --reload")
    logger.info("2. Check backend logs for [VIOLATION CHECK] and [VIOLATION SAVED] messages")
    logger.info("3. Test live camera page and trigger a violation (remove hard hat/vest)")
    logger.info("4. Check browser console for API errors")
    logger.info("5. Verify camera_id and domain_id are being sent from frontend")


if __name__ == "__main__":
    asyncio.run(main())

