"""
Snapshot Storage Utility
Saves violation frames to disk with organized directory structure
"""

import cv2
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Optional
import base64
from uuid import uuid4

from backend.config import settings
from backend.utils.logger import logger


# Legacy function for backward compatibility
def ensure_snapshots_dir() -> Path:
    """Ensure snapshot directory exists and return its path."""
    settings.snapshots_dir.mkdir(parents=True, exist_ok=True)
    return settings.snapshots_dir


def save_snapshot_image(data_url: str, prefix: str = "violation") -> Optional[str]:
    """
    Persist a base64 encoded data URL to the snapshots directory.
    LEGACY FUNCTION - kept for backward compatibility

    Args:
        data_url: Base64 encoded image coming from the frontend (data:image/jpeg;base64,...)
        prefix: Optional filename prefix

    Returns:
        Relative file name stored under settings.snapshots_dir or None if saving failed
    """
    if not data_url:
        return None

    try:
        # Strip data URL header if present
        if ";base64," in data_url:
            _, encoded = data_url.split(";base64,", 1)
        else:
            encoded = data_url

        binary = base64.b64decode(encoded)
        snapshots_dir = ensure_snapshots_dir()
        filename = f"{prefix}_{uuid4().hex}.jpg"
        file_path = snapshots_dir / filename
        file_path.write_bytes(binary)
        logger.debug(f"Snapshot saved to {file_path}")
        return filename
    except Exception as exc:
        logger.error(f"Failed to save snapshot image: {exc}")
        return None


class SnapshotManager:
    """
    Manages violation snapshot storage

    Features:
    - Saves frames to disk (organized by date/camera)
    - Draws bounding boxes on snapshots
    - Automatic directory creation
    - Cleanup of old snapshots

    Usage:
        manager = SnapshotManager()
        snapshot_path = manager.save_snapshot(
            frame=frame,
            camera_id=1,
            person_bbox={"x": 100, "y": 200, "w": 50, "h": 100}
        )
    """

    def __init__(self, base_dir: Optional[Path] = None):
        """
        Initialize snapshot manager

        Args:
            base_dir: Base directory for snapshots (default: data/snapshots/)
        """
        self.base_dir = base_dir or (settings.data_dir / "snapshots")
        self.base_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"SnapshotManager initialized: {self.base_dir}")

    def save_snapshot(
        self,
        frame: np.ndarray,
        camera_id: int,
        person_bbox: dict,
        track_id: Optional[int] = None,
        draw_bbox: bool = True,
        timestamp: Optional[datetime] = None
    ) -> str:
        """
        Save violation snapshot to disk

        Args:
            frame: Video frame (numpy array, BGR)
            camera_id: Camera ID
            person_bbox: Person bounding box {"x": int, "y": int, "w": int, "h": int}
            track_id: Person track ID (optional)
            draw_bbox: Draw bounding box on snapshot (default: True)
            timestamp: Snapshot timestamp (default: now)

        Returns:
            Relative path to saved snapshot (e.g., "2025/12/29/camera_1/violation_123456.jpg")
        """
        timestamp = timestamp or datetime.utcnow()

        # Create directory structure: YYYY/MM/DD/camera_{id}/
        date_path = self.base_dir / timestamp.strftime("%Y/%m/%d") / f"camera_{camera_id}"
        date_path.mkdir(parents=True, exist_ok=True)

        # Generate filename with timestamp and optional track_id
        filename = self._generate_filename(timestamp, track_id)
        file_path = date_path / filename

        # Draw bounding box if requested
        if draw_bbox:
            frame = self._draw_bbox(frame.copy(), person_bbox, track_id)

        # Save image
        success = cv2.imwrite(str(file_path), frame)

        if not success:
            logger.error(f"Failed to save snapshot: {file_path}")
            return None

        # Return relative path (for database storage)
        relative_path = str(file_path.relative_to(self.base_dir))

        logger.debug(f"Snapshot saved: {relative_path}")
        return relative_path

    def _generate_filename(
        self,
        timestamp: datetime,
        track_id: Optional[int] = None
    ) -> str:
        """
        Generate unique filename for snapshot

        Format: violation_{timestamp}_{track_id}.jpg
        Example: violation_20251229_143052_456_track_12.jpg
        """
        time_str = timestamp.strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Milliseconds

        if track_id is not None:
            return f"violation_{time_str}_track_{track_id}.jpg"
        else:
            return f"violation_{time_str}.jpg"

    def _draw_bbox(
        self,
        frame: np.ndarray,
        bbox: dict,
        track_id: Optional[int] = None
    ) -> np.ndarray:
        """
        Draw bounding box on frame

        Args:
            frame: Image frame
            bbox: Bounding box {"x": int, "y": int, "w": int, "h": int}
            track_id: Track ID to display (optional)

        Returns:
            Frame with bounding box drawn
        """
        x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

        # Draw red rectangle
        color = (0, 0, 255)  # BGR: Red
        thickness = 2
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)

        # Add label with track_id
        if track_id is not None:
            label = f"Person #{track_id}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            label_y = max(y - 10, label_size[1] + 10)

            # Background for text
            cv2.rectangle(
                frame,
                (x, label_y - label_size[1] - 5),
                (x + label_size[0], label_y + 5),
                color,
                -1  # Filled
            )

            # Text
            cv2.putText(
                frame,
                label,
                (x, label_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),  # White
                2
            )

        return frame

    def get_snapshot_path(self, relative_path: str) -> Path:
        """
        Convert relative path to absolute path

        Args:
            relative_path: Relative path from database

        Returns:
            Absolute path to snapshot file
        """
        return self.base_dir / relative_path

    def delete_snapshot(self, relative_path: str) -> bool:
        """
        Delete a snapshot file

        Args:
            relative_path: Relative path to snapshot

        Returns:
            True if deleted successfully
        """
        try:
            file_path = self.get_snapshot_path(relative_path)
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted snapshot: {relative_path}")
                return True
            else:
                logger.warning(f"Snapshot not found: {relative_path}")
                return False
        except Exception as e:
            logger.error(f"Failed to delete snapshot: {e}")
            return False

    def cleanup_old_snapshots(self, days_to_keep: int = 30):
        """
        Delete snapshots older than specified days

        Args:
            days_to_keep: Number of days to retain snapshots (default: 30)
        """
        cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = cutoff_date.replace(day=cutoff_date.day - days_to_keep)

        deleted_count = 0

        # Walk through directory structure
        for year_dir in self.base_dir.iterdir():
            if not year_dir.is_dir():
                continue

            for month_dir in year_dir.iterdir():
                if not month_dir.is_dir():
                    continue

                for day_dir in month_dir.iterdir():
                    if not day_dir.is_dir():
                        continue

                    # Parse date from directory path
                    try:
                        dir_date = datetime.strptime(
                            f"{year_dir.name}/{month_dir.name}/{day_dir.name}",
                            "%Y/%m/%d"
                        )

                        # Delete if older than cutoff
                        if dir_date < cutoff_date:
                            for camera_dir in day_dir.iterdir():
                                if camera_dir.is_dir():
                                    for snapshot in camera_dir.glob("*.jpg"):
                                        snapshot.unlink()
                                        deleted_count += 1
                                    camera_dir.rmdir()
                            day_dir.rmdir()

                    except Exception as e:
                        logger.error(f"Error processing directory {day_dir}: {e}")

        if deleted_count > 0:
            logger.info(f"Cleanup completed: {deleted_count} snapshots deleted")

        return deleted_count

    def get_stats(self) -> dict:
        """Get storage statistics"""
        total_snapshots = sum(1 for _ in self.base_dir.rglob("*.jpg"))

        total_size = sum(
            f.stat().st_size
            for f in self.base_dir.rglob("*.jpg")
        )

        return {
            "base_dir": str(self.base_dir),
            "total_snapshots": total_snapshots,
            "total_size_mb": round(total_size / (1024 * 1024), 2)
        }
