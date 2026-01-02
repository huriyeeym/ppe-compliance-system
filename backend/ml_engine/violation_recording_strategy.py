"""
Smart Violation Recording Strategy
Professional-grade violation recording with adaptive intervals
"""

from typing import Dict, Optional
from datetime import datetime, timedelta
from enum import Enum

from backend.utils.logger import logger


class RecordingReason(str, Enum):
    """Why was this violation recorded?"""
    FIRST_DETECTION = "first_detection"              # First time seeing this person violate
    STATUS_CHANGE = "status_change"                  # Compliance status changed
    INTERVAL_ELAPSED = "interval_elapsed"            # Recording interval elapsed
    SESSION_START = "session_start"                  # New violation session started
    SESSION_UPDATE = "session_update"                # Periodic session update
    SESSION_END = "session_end"                      # Violation session ended
    SEVERITY_CHANGE = "severity_change"              # Violation severity changed
    MANUAL = "manual"                                # Manual trigger


class ViolationSession:
    """
    Tracks a single violation session for a person

    A session = continuous period where person is:
    1. In camera view
    2. Violating PPE compliance
    """

    def __init__(
        self,
        track_id: int,
        started_at: datetime,
        severity: str,
        missing_ppe: list
    ):
        self.track_id = track_id
        self.started_at = started_at
        self.last_seen_at = started_at
        self.last_recorded_at = started_at
        self.severity = severity
        self.missing_ppe = missing_ppe
        self.record_count = 1  # Including initial record
        self.has_face = False  # Will be set by face detection

    def update(self, timestamp: datetime, severity: str, missing_ppe: list, has_face: bool = False):
        """Update session with new detection"""
        self.last_seen_at = timestamp
        self.severity = severity
        self.missing_ppe = missing_ppe
        self.has_face = has_face

    def mark_recorded(self, timestamp: datetime):
        """Mark that we recorded this session"""
        self.last_recorded_at = timestamp
        self.record_count += 1

    def duration_seconds(self, current_time: datetime) -> float:
        """Total session duration in seconds"""
        return (current_time - self.started_at).total_seconds()

    def time_since_last_record(self, current_time: datetime) -> float:
        """Seconds since last record"""
        return (current_time - self.last_recorded_at).total_seconds()

    def is_stale(self, current_time: datetime, stale_threshold_seconds: int = 30) -> bool:
        """Check if session is stale (person likely left frame)"""
        return (current_time - self.last_seen_at).total_seconds() > stale_threshold_seconds


class SmartRecordingStrategy:
    """
    Professional violation recording strategy with adaptive intervals

    Recording Rules:
    1. First detection → Record immediately
    2. Status change (compliant ↔ violating) → Record immediately
    3. Severity change → Record immediately
    4. Face detected + long session → Record every 10 minutes
    5. No face detected → Record every 1 minute
    6. Session end (person left) → Record final snapshot

    Features:
    - Face detection aware (can integrate with face recognition)
    - Session tracking (entry, ongoing, exit)
    - Adaptive intervals based on context
    - Audit trail with recording reasons
    """

    def __init__(
        self,
        interval_with_face_seconds: int = 600,       # 10 minutes if face detected
        interval_without_face_seconds: int = 60,     # 1 minute if no face
        interval_critical_seconds: int = 120,        # 2 minutes for critical violations
        session_end_grace_period: int = 30,          # 30 seconds to consider session ended
        enable_session_tracking: bool = True
    ):
        """
        Initialize smart recording strategy

        Args:
            interval_with_face_seconds: Recording interval when face is detected (default: 10 min)
            interval_without_face_seconds: Recording interval when no face (default: 1 min)
            interval_critical_seconds: Recording interval for critical violations (default: 2 min)
            session_end_grace_period: Seconds without detection before session ends
            enable_session_tracking: Enable session tracking (entry/exit snapshots)
        """
        self.interval_with_face = interval_with_face_seconds
        self.interval_without_face = interval_without_face_seconds
        self.interval_critical = interval_critical_seconds
        self.session_end_grace = session_end_grace_period
        self.enable_session_tracking = enable_session_tracking

        # Active violation sessions (track_id → ViolationSession)
        self.active_sessions: Dict[int, ViolationSession] = {}

        # Compliance status tracking (for status change detection)
        self.last_compliance_status: Dict[int, bool] = {}

        # Statistics
        self.total_detections = 0
        self.total_recordings = 0
        self.recordings_by_reason: Dict[str, int] = {}

        logger.info("SmartRecordingStrategy initialized")
        logger.info(f"  Interval with face: {interval_with_face_seconds}s")
        logger.info(f"  Interval without face: {interval_without_face_seconds}s")
        logger.info(f"  Interval critical: {interval_critical_seconds}s")
        logger.info(f"  Session tracking: {enable_session_tracking}")

    def should_record(
        self,
        track_id: Optional[int],
        is_compliant: bool,
        severity: str = "medium",
        missing_ppe: list = None,
        has_face: bool = False,
        timestamp: Optional[datetime] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Decide if violation should be recorded

        Args:
            track_id: Person tracking ID (None if tracking disabled)
            is_compliant: Current compliance status
            severity: Violation severity ("none", "warning", "critical")
            missing_ppe: List of missing PPE items
            has_face: Whether face was detected (for adaptive intervals)
            timestamp: Detection timestamp (default: now)

        Returns:
            (should_record: bool, reason: str | None)
        """
        self.total_detections += 1
        timestamp = timestamp or datetime.utcnow()
        missing_ppe = missing_ppe or []

        # If tracking disabled, use simple logic
        if track_id is None:
            if not is_compliant:
                self._increment_recording(RecordingReason.MANUAL)
                return True, RecordingReason.MANUAL
            return False, None

        # If compliant, handle session end
        if is_compliant:
            return self._handle_compliant_detection(track_id, timestamp)

        # Person is violating - check recording logic
        return self._handle_violation_detection(
            track_id, severity, missing_ppe, has_face, timestamp
        )

    def _handle_compliant_detection(
        self,
        track_id: int,
        timestamp: datetime
    ) -> tuple[bool, Optional[str]]:
        """Handle detection where person is compliant"""

        # Update compliance status
        previous_status = self.last_compliance_status.get(track_id)
        self.last_compliance_status[track_id] = True

        # If session exists, end it
        if track_id in self.active_sessions:
            session = self.active_sessions[track_id]

            if self.enable_session_tracking:
                # Record session end
                logger.info(f"Track {track_id}: Violation session ended (became compliant)")
                del self.active_sessions[track_id]
                self._increment_recording(RecordingReason.SESSION_END)
                return True, RecordingReason.SESSION_END
            else:
                # Just remove session
                del self.active_sessions[track_id]

        return False, None

    def _handle_violation_detection(
        self,
        track_id: int,
        severity: str,
        missing_ppe: list,
        has_face: bool,
        timestamp: datetime
    ) -> tuple[bool, Optional[str]]:
        """Handle detection where person is violating"""

        # Check for status change (compliant → violating)
        previous_status = self.last_compliance_status.get(track_id)
        self.last_compliance_status[track_id] = False

        if previous_status is True:
            # Status changed: compliant → violating
            logger.info(f"Track {track_id}: Status change (compliant → violating)")
            self._start_new_session(track_id, severity, missing_ppe, timestamp, has_face)
            self._increment_recording(RecordingReason.STATUS_CHANGE)
            return True, RecordingReason.STATUS_CHANGE

        # Check if session exists
        if track_id not in self.active_sessions:
            # First violation for this person
            logger.info(f"Track {track_id}: First violation detected")
            self._start_new_session(track_id, severity, missing_ppe, timestamp, has_face)
            self._increment_recording(RecordingReason.FIRST_DETECTION)
            return True, RecordingReason.FIRST_DETECTION

        # Session exists - update and check intervals
        session = self.active_sessions[track_id]
        session.update(timestamp, severity, missing_ppe, has_face)

        # Check for severity change
        if severity != session.severity:
            logger.info(f"Track {track_id}: Severity changed ({session.severity} → {severity})")
            session.mark_recorded(timestamp)
            self._increment_recording(RecordingReason.SEVERITY_CHANGE)
            return True, RecordingReason.SEVERITY_CHANGE

        # Check recording interval
        time_since_last = session.time_since_last_record(timestamp)

        # Determine appropriate interval
        if severity == "critical":
            interval = self.interval_critical
        elif has_face or session.has_face:
            interval = self.interval_with_face
        else:
            interval = self.interval_without_face

        if time_since_last >= interval:
            duration = session.duration_seconds(timestamp)
            logger.info(
                f"Track {track_id}: Recording interval elapsed "
                f"({time_since_last:.0f}s >= {interval}s, total duration: {duration:.0f}s)"
            )
            session.mark_recorded(timestamp)
            self._increment_recording(RecordingReason.INTERVAL_ELAPSED)
            return True, RecordingReason.INTERVAL_ELAPSED

        # Don't record - within interval
        return False, None

    def _start_new_session(
        self,
        track_id: int,
        severity: str,
        missing_ppe: list,
        timestamp: datetime,
        has_face: bool
    ):
        """Start a new violation session"""
        session = ViolationSession(track_id, timestamp, severity, missing_ppe)
        session.has_face = has_face
        self.active_sessions[track_id] = session

    def _increment_recording(self, reason: RecordingReason):
        """Increment recording statistics"""
        self.total_recordings += 1
        self.recordings_by_reason[reason] = self.recordings_by_reason.get(reason, 0) + 1

    def cleanup_stale_sessions(self, current_time: Optional[datetime] = None):
        """
        Remove stale sessions (persons who likely left the frame)

        Args:
            current_time: Current timestamp (default: now)
        """
        current_time = current_time or datetime.utcnow()

        stale_tracks = [
            track_id
            for track_id, session in self.active_sessions.items()
            if session.is_stale(current_time, self.session_end_grace)
        ]

        for track_id in stale_tracks:
            session = self.active_sessions[track_id]
            duration = session.duration_seconds(current_time)

            logger.info(
                f"Track {track_id}: Session cleaned up (stale, duration: {duration:.0f}s)"
            )

            # Could record session end here if needed
            # For now, just remove
            del self.active_sessions[track_id]

        return len(stale_tracks)

    def get_active_session(self, track_id: int) -> Optional[ViolationSession]:
        """Get active session for a track ID"""
        return self.active_sessions.get(track_id)

    def get_stats(self) -> Dict:
        """Get recording statistics"""
        return {
            "total_detections": self.total_detections,
            "total_recordings": self.total_recordings,
            "active_sessions": len(self.active_sessions),
            "recordings_by_reason": dict(self.recordings_by_reason),
            "recording_rate_percent": round(
                (self.total_recordings / self.total_detections * 100)
                if self.total_detections > 0 else 0,
                2
            ),
            "config": {
                "interval_with_face": self.interval_with_face,
                "interval_without_face": self.interval_without_face,
                "interval_critical": self.interval_critical
            }
        }

    def reset(self):
        """Reset all state"""
        self.active_sessions.clear()
        self.last_compliance_status.clear()
        self.total_detections = 0
        self.total_recordings = 0
        self.recordings_by_reason.clear()
        logger.info("SmartRecordingStrategy reset")
