"""
Utilities for handling violation snapshot images.
"""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Optional
from uuid import uuid4

from backend.config import settings
from backend.utils.logger import logger


def ensure_snapshots_dir() -> Path:
    """Ensure snapshot directory exists and return its path."""
    settings.snapshots_dir.mkdir(parents=True, exist_ok=True)
    return settings.snapshots_dir


def save_snapshot_image(data_url: str, prefix: str = "violation") -> Optional[str]:
    """
    Persist a base64 encoded data URL to the snapshots directory.

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

