"""
Add default camera to database
"""

import sys
import asyncio
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from backend.database.connection import AsyncSessionLocal
from backend.database import models
from backend.utils.logger import logger


async def add_default_camera():
    """Add default laptop webcam"""

    logger.info("Adding default camera to database...")

    async with AsyncSessionLocal() as db:
        try:
            # Check if camera already exists
            from sqlalchemy import select
            result = await db.execute(select(models.Camera))
            existing_cameras = result.scalars().all()

            if len(existing_cameras) > 0:
                logger.info(f"Camera already exists: {existing_cameras[0].name}")
                return

            # Add default camera
            camera = models.Camera(
                name="Laptop Kamera",
                domain_id=1,  # İnşaat alanı
                source_type=models.SourceType.WEBCAM,
                source_uri="0",  # Default webcam index
                is_active=True,
                location="Test Lokasyonu"
            )
            db.add(camera)
            await db.commit()

            logger.info("✅ Camera added successfully!")
            logger.info(f"   Name: {camera.name}")
            logger.info(f"   Type: {camera.source_type}")
            logger.info(f"   Domain: İnşaat (ID: 1)")
            logger.info(f"   URI: {camera.source_uri}")

        except Exception as e:
            logger.error(f"Failed to add camera: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(add_default_camera())
