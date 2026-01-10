"""
Bounding Box Smoothing Module
Stabilizes bounding boxes across frames using exponential moving average
"""

from typing import Dict, Optional
from collections import defaultdict
import numpy as np

from backend.utils.logger import logger


class BoundingBoxSmoother:
    """
    Smooths bounding boxes across frames to reduce jitter
    
    Uses exponential moving average (EMA) to stabilize bounding box positions
    """
    
    def __init__(self, alpha: float = 0.7):
        """
        Initialize bounding box smoother
        
        Args:
            alpha: Smoothing factor (0.0-1.0)
                - 0.0 = no smoothing (use raw values)
                - 1.0 = maximum smoothing (ignore new values)
                - 0.7 = good balance (recommended)
        """
        self.alpha = alpha
        # Store smoothed bboxes per track_id: {track_id: {"x": float, "y": float, "w": float, "h": float}}
        self.smoothed_bboxes: Dict[int, Dict[str, float]] = defaultdict(lambda: None)
        
        logger.info(f"BoundingBoxSmoother initialized with alpha={alpha}")
    
    def smooth(self, track_id: Optional[int], bbox: Dict[str, int]) -> Dict[str, int]:
        """
        Smooth a bounding box using exponential moving average
        
        Args:
            track_id: Track ID for the person (None if no tracking)
            bbox: Bounding box {"x": int, "y": int, "w": int, "h": int}
        
        Returns:
            Smoothed bounding box (same format)
        """
        # If no track_id, return original bbox (can't smooth without tracking)
        if track_id is None:
            return bbox
        
        # Convert to float for calculations
        current_bbox = {
            "x": float(bbox["x"]),
            "y": float(bbox["y"]),
            "w": float(bbox["w"]),
            "h": float(bbox["h"])
        }
        
        # Get previous smoothed bbox
        prev_bbox = self.smoothed_bboxes.get(track_id)
        
        if prev_bbox is None:
            # First time seeing this track_id - use current bbox as baseline
            smoothed_bbox = current_bbox.copy()
        else:
            # Apply exponential moving average
            smoothed_bbox = {
                "x": self.alpha * prev_bbox["x"] + (1 - self.alpha) * current_bbox["x"],
                "y": self.alpha * prev_bbox["y"] + (1 - self.alpha) * current_bbox["y"],
                "w": self.alpha * prev_bbox["w"] + (1 - self.alpha) * current_bbox["w"],
                "h": self.alpha * prev_bbox["h"] + (1 - self.alpha) * current_bbox["h"]
            }
        
        # Store smoothed bbox for next frame
        self.smoothed_bboxes[track_id] = smoothed_bbox
        
        # Convert back to int (round to nearest)
        return {
            "x": int(round(smoothed_bbox["x"])),
            "y": int(round(smoothed_bbox["y"])),
            "w": int(round(smoothed_bbox["w"])),
            "h": int(round(smoothed_bbox["h"]))
        }
    
    def reset_track(self, track_id: int):
        """Reset smoothing state for a specific track"""
        if track_id in self.smoothed_bboxes:
            del self.smoothed_bboxes[track_id]
            logger.debug(f"Reset smoothing for track {track_id}")
    
    def reset_all(self):
        """Reset all smoothing state"""
        self.smoothed_bboxes.clear()
        logger.debug("Reset all bounding box smoothing")

