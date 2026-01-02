"""
Violation Deduplication Manager
Prevents duplicate violation records for the same person
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from backend.utils.logger import logger


class ViolationManager:
    """
    Manages violation deduplication based on track IDs

    Features:
    - Prevents duplicate violations for same person (same track_id)
    - Time-based throttling (don't record same violation every frame)
    - Status change detection (compliant -> non-compliant)

    Usage:
        manager = ViolationManager(cooldown_seconds=60)
        if manager.should_record_violation(track_id, is_compliant):
            # Record violation to database
            manager.mark_violation_recorded(track_id)
    """

    def __init__(
        self,
        cooldown_seconds: int = 60,
        enable_deduplication: bool = True
    ):
        """
        Initialize violation manager

        Args:
            cooldown_seconds: Minimum time between violations for same person (default: 60s)
            enable_deduplication: Enable deduplication logic (default: True)
        """
        self.cooldown_seconds = cooldown_seconds
        self.enable_deduplication = enable_deduplication

        # Track last violation time per track_id
        self.last_violation_time: Dict[int, datetime] = {}

        # Track last compliance status per track_id
        self.last_compliance_status: Dict[int, bool] = {}

        # Statistics
        self.total_detections = 0
        self.violations_recorded = 0
        self.violations_skipped = 0

        logger.info("ViolationManager initialized")
        logger.info(f"Cooldown: {cooldown_seconds}s")
        logger.info(f"Deduplication enabled: {enable_deduplication}")

    def should_record_violation(
        self,
        track_id: Optional[int],
        is_compliant: bool,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Check if violation should be recorded for this person

        Args:
            track_id: Unique person ID from tracker (None if tracking disabled)
            is_compliant: Current compliance status
            timestamp: Detection timestamp (default: now)

        Returns:
            True if violation should be recorded, False to skip
        """
        self.total_detections += 1

        # If deduplication disabled, always record non-compliant
        if not self.enable_deduplication:
            if not is_compliant:
                self.violations_recorded += 1
                return True
            return False

        # If tracking disabled (no track_id), always record
        if track_id is None:
            if not is_compliant:
                self.violations_recorded += 1
                return True
            return False

        # If person is compliant, don't record violation
        if is_compliant:
            # Update compliance status
            self.last_compliance_status[track_id] = True
            return False

        # Person is non-compliant, check if we should record
        timestamp = timestamp or datetime.utcnow()

        # Check if this is a status change (compliant -> non-compliant)
        previous_status = self.last_compliance_status.get(track_id)
        if previous_status is True:  # Was compliant, now non-compliant
            logger.info(f"Track {track_id}: Status change (compliant -> violation)")
            self._record_violation(track_id, timestamp)
            return True

        # Check cooldown period
        last_time = self.last_violation_time.get(track_id)
        if last_time is None:
            # First violation for this person
            logger.info(f"Track {track_id}: First violation")
            self._record_violation(track_id, timestamp)
            return True

        # Check if cooldown has elapsed
        time_since_last = (timestamp - last_time).total_seconds()
        if time_since_last >= self.cooldown_seconds:
            logger.info(f"Track {track_id}: Cooldown elapsed ({time_since_last:.1f}s)")
            self._record_violation(track_id, timestamp)
            return True

        # Skip - within cooldown period
        self.violations_skipped += 1
        return False

    def _record_violation(self, track_id: int, timestamp: datetime):
        """Mark violation as recorded"""
        self.last_violation_time[track_id] = timestamp
        self.last_compliance_status[track_id] = False
        self.violations_recorded += 1

    def mark_violation_recorded(
        self,
        track_id: Optional[int],
        timestamp: Optional[datetime] = None
    ):
        """
        Manually mark a violation as recorded (for external use)

        Args:
            track_id: Person track ID
            timestamp: Violation timestamp (default: now)
        """
        if track_id is not None:
            timestamp = timestamp or datetime.utcnow()
            self.last_violation_time[track_id] = timestamp
            self.last_compliance_status[track_id] = False

    def cleanup_old_tracks(self, max_age_seconds: int = 300):
        """
        Remove old tracks from memory (housekeeping)

        Args:
            max_age_seconds: Remove tracks older than this (default: 5 minutes)
        """
        now = datetime.utcnow()
        cutoff_time = now - timedelta(seconds=max_age_seconds)

        # Find old tracks
        old_tracks = [
            track_id
            for track_id, last_time in self.last_violation_time.items()
            if last_time < cutoff_time
        ]

        # Remove
        for track_id in old_tracks:
            del self.last_violation_time[track_id]
            if track_id in self.last_compliance_status:
                del self.last_compliance_status[track_id]

        if old_tracks:
            logger.info(f"Cleaned up {len(old_tracks)} old tracks")

    def reset(self):
        """Reset all state"""
        self.last_violation_time.clear()
        self.last_compliance_status.clear()
        self.total_detections = 0
        self.violations_recorded = 0
        self.violations_skipped = 0
        logger.info("ViolationManager reset")

    def get_stats(self) -> Dict:
        """Get violation statistics"""
        skip_rate = (
            (self.violations_skipped / self.total_detections * 100)
            if self.total_detections > 0
            else 0
        )

        return {
            "total_detections": self.total_detections,
            "violations_recorded": self.violations_recorded,
            "violations_skipped": self.violations_skipped,
            "skip_rate_percent": round(skip_rate, 2),
            "active_tracks": len(self.last_violation_time),
            "cooldown_seconds": self.cooldown_seconds
        }
