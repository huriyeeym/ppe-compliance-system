"""
Person Tracking Module using ByteTrack
Assigns unique IDs to persons across video frames
"""

from typing import List, Dict, Optional
import numpy as np
import supervision as sv

from backend.utils.logger import logger


class PersonTracker:
    """
    Tracks persons across frames using ByteTrack algorithm

    Features:
    - Assigns unique track_id to each person
    - Maintains identity across frames
    - Handles occlusions and re-identification

    Usage:
        tracker = PersonTracker()
        detections_with_ids = tracker.update(detections)
    """

    def __init__(
        self,
        track_thresh: float = 0.25,
        track_buffer: int = 30,
        match_thresh: float = 0.8,
        frame_rate: int = 30
    ):
        """
        Initialize person tracker

        Args:
            track_thresh: Detection confidence threshold for tracking
            track_buffer: Number of frames to keep lost tracks
            match_thresh: IOU threshold for matching detections to tracks
            frame_rate: Video frame rate (affects track lifetime)
        """
        self.tracker = sv.ByteTrack(
            track_thresh=track_thresh,
            track_buffer=track_buffer,
            match_thresh=match_thresh,
            frame_rate=frame_rate
        )

        self.frame_count = 0

        logger.info("PersonTracker initialized (ByteTrack)")
        logger.info(f"Track threshold: {track_thresh}")
        logger.info(f"Track buffer: {track_buffer} frames")
        logger.info(f"Match threshold: {match_thresh}")

    def update(self, detections: List[Dict]) -> List[Dict]:
        """
        Update tracker with new detections and assign track IDs

        Args:
            detections: List of person detections from PPEDetector
                Each detection should have:
                - bbox: {"x": int, "y": int, "w": int, "h": int}
                - confidence: float
                - Other fields (ppe_items, missing_ppe, etc.)

        Returns:
            Same detections with added "track_id" field
        """
        self.frame_count += 1

        # If no detections, return empty
        if not detections:
            # Update tracker with empty detections to age out old tracks
            _ = self.tracker.update_with_detections(sv.Detections.empty())
            return []

        # Convert detections to supervision format
        sv_detections = self._to_supervision_detections(detections)

        # Update tracker
        tracked_detections = self.tracker.update_with_detections(sv_detections)

        # Add track IDs back to original detections
        detections_with_ids = self._add_track_ids(detections, tracked_detections)

        return detections_with_ids

    def _to_supervision_detections(self, detections: List[Dict]) -> sv.Detections:
        """
        Convert PPEDetector format to supervision.Detections format

        Args:
            detections: List of detections with bbox format {x, y, w, h}

        Returns:
            supervision.Detections object
        """
        if not detections:
            return sv.Detections.empty()

        # Extract bboxes in xyxy format
        xyxy = []
        confidences = []

        for det in detections:
            bbox = det["bbox"]
            x1 = bbox["x"]
            y1 = bbox["y"]
            x2 = bbox["x"] + bbox["w"]
            y2 = bbox["y"] + bbox["h"]

            xyxy.append([x1, y1, x2, y2])
            confidences.append(det.get("confidence", 1.0))

        # Create supervision Detections
        return sv.Detections(
            xyxy=np.array(xyxy, dtype=np.float32),
            confidence=np.array(confidences, dtype=np.float32)
        )

    def _add_track_ids(
        self,
        original_detections: List[Dict],
        tracked_detections: sv.Detections
    ) -> List[Dict]:
        """
        Add track IDs from supervision tracker back to original detections

        Args:
            original_detections: Original detection list
            tracked_detections: Tracked detections from supervision

        Returns:
            Original detections with track_id field added
        """
        # Supervision returns detections in same order, just adds tracker_id
        detections_with_ids = []

        for i, det in enumerate(original_detections):
            # Copy detection
            det_with_id = det.copy()

            # Add track ID if available
            if tracked_detections.tracker_id is not None and i < len(tracked_detections.tracker_id):
                det_with_id["track_id"] = int(tracked_detections.tracker_id[i])
            else:
                det_with_id["track_id"] = None

            detections_with_ids.append(det_with_id)

        return detections_with_ids

    def reset(self):
        """Reset tracker (start fresh)"""
        self.tracker.reset()
        self.frame_count = 0
        logger.info("PersonTracker reset")

    def get_stats(self) -> Dict:
        """Get tracker statistics"""
        return {
            "frame_count": self.frame_count,
            "active_tracks": len(self.tracker.tracker.tracked_stracks) if hasattr(self.tracker, 'tracker') else 0
        }
