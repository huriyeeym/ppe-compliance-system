"""
Video Recording Utility
Records video segments for violations with ring buffer support
"""

import cv2
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Deque
from collections import deque
import threading
from uuid import uuid4

from backend.config import settings
from backend.utils.logger import logger


class RingBuffer:
    """
    Ring buffer for storing video frames
    Maintains a fixed-size buffer of recent frames
    """
    
    def __init__(self, max_frames: int, fps: float = 30.0):
        """
        Initialize ring buffer
        
        Args:
            max_frames: Maximum number of frames to store
            fps: Frames per second (for duration calculation)
        """
        self.max_frames = max_frames
        self.fps = fps
        self.buffer: Deque[tuple[np.ndarray, datetime]] = deque(maxlen=max_frames)
        self.lock = threading.Lock()
    
    def add_frame(self, frame: np.ndarray, timestamp: Optional[datetime] = None):
        """Add a frame to the buffer"""
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        with self.lock:
            self.buffer.append((frame.copy(), timestamp))
    
    def get_frames(self, seconds_before: float = 0, seconds_after: float = 0) -> list[tuple[np.ndarray, datetime]]:
        """
        Get frames from buffer
        
        Args:
            seconds_before: Seconds before current time to include
            seconds_after: Seconds after current time to include (for future frames)
        
        Returns:
            List of (frame, timestamp) tuples
        """
        with self.lock:
            if not self.buffer:
                return []
            
            current_time = datetime.utcnow()
            start_time = current_time - timedelta(seconds=seconds_before)
            end_time = current_time + timedelta(seconds=seconds_after)
            
            frames = []
            for frame, timestamp in self.buffer:
                if start_time <= timestamp <= end_time:
                    frames.append((frame, timestamp))
            
            return frames
    
    def clear(self):
        """Clear the buffer"""
        with self.lock:
            self.buffer.clear()
    
    def size(self) -> int:
        """Get current buffer size"""
        with self.lock:
            return len(self.buffer)
    
    def duration_seconds(self) -> float:
        """Get total duration of buffered frames in seconds"""
        with self.lock:
            if len(self.buffer) < 2:
                return 0.0
            
            first_timestamp = self.buffer[0][1]
            last_timestamp = self.buffer[-1][1]
            return (last_timestamp - first_timestamp).total_seconds()


class VideoRecorder:
    """
    Manages video recording for violations
    
    Features:
    - Ring buffer for recent frames (violation öncesi kayıt)
    - Video segment kaydetme (MP4/H.264)
    - Organized directory structure
    - Automatic cleanup
    """
    
    def __init__(
        self,
        base_dir: Optional[Path] = None,
        buffer_duration_seconds: int = 30,  # Son 30 saniyeyi tut
        fps: float = 30.0,
        video_quality: int = 23  # H.264 CRF (lower = better quality, 18-28 range)
    ):
        """
        Initialize video recorder
        
        Args:
            base_dir: Base directory for videos (default: data/videos/)
            buffer_duration_seconds: How many seconds to keep in buffer
            fps: Frames per second for recording
            video_quality: H.264 CRF value (18-28, lower is better)
        """
        self.base_dir = base_dir or (settings.data_dir / "videos")
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
        # Calculate max frames for buffer
        max_frames = int(buffer_duration_seconds * fps)
        self.ring_buffer = RingBuffer(max_frames=max_frames, fps=fps)
        self.fps = fps
        self.video_quality = video_quality
        
        logger.info(f"VideoRecorder initialized: {self.base_dir}")
        logger.info(f"  Buffer duration: {buffer_duration_seconds}s ({max_frames} frames)")
        logger.info(f"  FPS: {fps}, Quality: CRF {video_quality}")
    
    def add_frame(self, frame: np.ndarray, timestamp: Optional[datetime] = None):
        """
        Add frame to ring buffer
        
        Args:
            frame: Video frame (numpy array, BGR)
            timestamp: Frame timestamp (default: now)
        """
        self.ring_buffer.add_frame(frame, timestamp)
    
    def save_video_segment(
        self,
        camera_id: int,
        track_id: Optional[int] = None,
        seconds_before: float = 10.0,
        seconds_after: float = 5.0,
        timestamp: Optional[datetime] = None,
        draw_bbox: Optional[dict] = None
    ) -> Optional[str]:
        """
        Save video segment from ring buffer
        
        Args:
            camera_id: Camera ID
            track_id: Person track ID (optional)
            seconds_before: Seconds before violation to include
            seconds_after: Seconds after violation to include
            timestamp: Violation timestamp (default: now)
            draw_bbox: Optional bounding box to draw on frames {"x": int, "y": int, "w": int, "h": int}
        
        Returns:
            Relative path to saved video (e.g., "2025/12/29/camera_1/violation_123456.mp4")
            or None if failed
        """
        timestamp = timestamp or datetime.utcnow()
        
        # Get frames from buffer
        frames = self.ring_buffer.get_frames(
            seconds_before=seconds_before,
            seconds_after=seconds_after
        )
        
        if not frames:
            logger.warning("No frames in buffer to save")
            return None
        
        # Create directory structure: YYYY/MM/DD/camera_{id}/
        date_path = self.base_dir / timestamp.strftime("%Y/%m/%d") / f"camera_{camera_id}"
        date_path.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        filename = self._generate_filename(timestamp, track_id)
        file_path = date_path / filename
        
        # Write video
        try:
            height, width = frames[0][0].shape[:2]
            
            # H.264 codec with quality settings
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            video_writer = cv2.VideoWriter(
                str(file_path),
                fourcc,
                self.fps,
                (width, height)
            )
            
            if not video_writer.isOpened():
                logger.error(f"Failed to open video writer: {file_path}")
                return None
            
            # Write frames
            for frame, _ in frames:
                # Draw bounding box if provided
                if draw_bbox:
                    frame = self._draw_bbox(frame.copy(), draw_bbox, track_id)
                
                video_writer.write(frame)
            
            video_writer.release()
            
            # Return relative path
            relative_path = str(file_path.relative_to(self.base_dir))
            logger.info(f"Video segment saved: {relative_path} ({len(frames)} frames, {len(frames)/self.fps:.1f}s)")
            
            return relative_path
            
        except Exception as e:
            logger.error(f"Failed to save video segment: {e}")
            return None
    
    def _generate_filename(
        self,
        timestamp: datetime,
        track_id: Optional[int] = None
    ) -> str:
        """
        Generate unique filename for video
        
        Format: violation_{timestamp}_{track_id}.mp4
        Example: violation_20251229_143052_456_track_12.mp4
        """
        time_str = timestamp.strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Milliseconds
        
        if track_id is not None:
            return f"violation_{time_str}_track_{track_id}.mp4"
        else:
            return f"violation_{time_str}.mp4"
    
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
    
    def get_video_path(self, relative_path: str) -> Path:
        """
        Convert relative path to absolute path
        
        Args:
            relative_path: Relative path from database
        
        Returns:
            Absolute path to video file
        """
        return self.base_dir / relative_path
    
    def delete_video(self, relative_path: str) -> bool:
        """
        Delete a video file
        
        Args:
            relative_path: Relative path to video
        
        Returns:
            True if deleted successfully
        """
        try:
            file_path = self.get_video_path(relative_path)
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted video: {relative_path}")
                return True
            else:
                logger.warning(f"Video not found: {relative_path}")
                return False
        except Exception as e:
            logger.error(f"Failed to delete video: {e}")
            return False
    
    def cleanup_old_videos(self, days_to_keep: int = 30):
        """
        Delete videos older than specified days
        
        Args:
            days_to_keep: Number of days to retain videos (default: 30)
        
        Returns:
            Number of videos deleted
        """
        cutoff_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff_date = cutoff_date - timedelta(days=days_to_keep)
        
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
                                    for video in camera_dir.glob("*.mp4"):
                                        video.unlink()
                                        deleted_count += 1
                                    camera_dir.rmdir()
                            day_dir.rmdir()
                    
                    except Exception as e:
                        logger.error(f"Error processing directory {day_dir}: {e}")
        
        if deleted_count > 0:
            logger.info(f"Video cleanup completed: {deleted_count} videos deleted")
        
        return deleted_count
    
    def get_stats(self) -> dict:
        """Get storage statistics"""
        total_videos = sum(1 for _ in self.base_dir.rglob("*.mp4"))
        
        total_size = sum(
            f.stat().st_size
            for f in self.base_dir.rglob("*.mp4")
        )
        
        return {
            "base_dir": str(self.base_dir),
            "total_videos": total_videos,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "buffer_frames": self.ring_buffer.size(),
            "buffer_duration_seconds": self.ring_buffer.duration_seconds()
        }

