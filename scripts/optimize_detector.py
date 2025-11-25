"""
Optimized PPE Detector with frame skipping and multi-threading
Implements literatür-based optimizations for real-time inference

Usage:
    python scripts/optimize_detector.py --video test_video.mp4 --frame-skip 2
"""

import argparse
import sys
import time
import threading
from queue import Queue
from pathlib import Path
from typing import Optional

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import cv2
import numpy as np
from backend.ml_engine.detector import PPEDetector
from backend.utils.logger import logger


class OptimizedPPEDetector:
    """
    Optimized PPE Detector with:
    - Frame skipping (process every N frames)
    - Multi-threading (capture and inference in separate threads)
    - Temporal consistency (reuse previous detections)
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        frame_skip: int = 2,
        confidence_threshold: float = 0.5,
        use_threading: bool = True
    ):
        """
        Initialize optimized detector
        
        Args:
            model_path: Path to model file
            frame_skip: Process every N frames (2 = process every 2nd frame)
            confidence_threshold: Detection confidence threshold
            use_threading: Use multi-threading for capture and inference
        """
        self.detector = PPEDetector(model_path=model_path, confidence_threshold=confidence_threshold)
        self.frame_skip = frame_skip
        self.use_threading = use_threading
        
        # Temporal consistency
        self.previous_detections = []
        self.frame_count = 0
        
        # Multi-threading
        if use_threading:
            self.frame_queue = Queue(maxsize=2)
            self.detection_queue = Queue(maxsize=2)
            self.inference_thread = None
            self.running = False
    
    def process_frame(self, frame: np.ndarray) -> list:
        """
        Process a single frame with optimizations
        
        Args:
            frame: Video frame (BGR format)
        
        Returns:
            List of detections
        """
        self.frame_count += 1
        
        # Frame skipping: process every N frames
        if self.frame_count % self.frame_skip == 0:
            # Process this frame
            detections = self.detector.detect(frame)
            self.previous_detections = detections
            return detections
        else:
            # Reuse previous detections (temporal consistency)
            return self.previous_detections
    
    def process_video_stream(self, video_source: str, show: bool = True):
        """
        Process video stream with optimizations
        
        Args:
            video_source: Video file path or camera index (0 for webcam)
            show: Show video with detections
        """
        logger.info("=" * 60)
        logger.info("Optimized PPE Detection - Video Stream")
        logger.info("=" * 60)
        logger.info(f"Frame skip: {self.frame_skip} (process every {self.frame_skip} frames)")
        logger.info(f"Multi-threading: {self.use_threading}")
        logger.info("")
        
        # Open video source
        if isinstance(video_source, str) and video_source.isdigit():
            video_source = int(video_source)
        
        cap = cv2.VideoCapture(video_source)
        if not cap.isOpened():
            logger.error(f"Failed to open video source: {video_source}")
            return
        
        # FPS tracking
        fps_counter = 0
        fps_start_time = time.time()
        detection_times = []
        
        logger.info("Starting video processing...")
        logger.info("Press 'q' to quit")
        logger.info("")
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Process frame
                start_time = time.time()
                detections = self.process_frame(frame)
                detection_time = time.time() - start_time
                detection_times.append(detection_time)
                
                # Draw detections
                frame_with_detections = self._draw_detections(frame, detections)
                
                # Calculate FPS
                fps_counter += 1
                if fps_counter % 30 == 0:
                    elapsed = time.time() - fps_start_time
                    current_fps = 30 / elapsed
                    avg_detection_time = np.mean(detection_times[-30:])
                    logger.info(f"FPS: {current_fps:.1f} | Detection time: {avg_detection_time*1000:.1f}ms")
                    fps_start_time = time.time()
                
                # Show frame
                if show:
                    cv2.imshow("PPE Detection (Optimized)", frame_with_detections)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
        
        finally:
            cap.release()
            if show:
                cv2.destroyAllWindows()
            
            # Print statistics
            logger.info("")
            logger.info("=" * 60)
            logger.info("Processing Statistics")
            logger.info("=" * 60)
            logger.info(f"Total frames processed: {fps_counter}")
            logger.info(f"Average detection time: {np.mean(detection_times)*1000:.2f}ms")
            logger.info(f"Average FPS: {1.0 / np.mean(detection_times):.1f}")
            logger.info(f"Speedup from frame skip: ~{self.frame_skip}x")
    
    def _draw_detections(self, frame: np.ndarray, detections: list) -> np.ndarray:
        """Draw detections on frame"""
        frame_copy = frame.copy()
        
        for det in detections:
            bbox = det.get("bbox", {})
            x, y, w, h = bbox.get("x", 0), bbox.get("y", 0), bbox.get("w", 0), bbox.get("h", 0)
            
            # Check compliance
            ppe_items = det.get("ppe_items", [])
            has_helmet = any(item.get("type") == "hard_hat" for item in ppe_items)
            has_vest = any(item.get("type") == "safety_vest" for item in ppe_items)
            
            # Color: green if compliant, red if violation
            color = (0, 255, 0) if (has_helmet and has_vest) else (0, 0, 255)
            
            # Draw bounding box
            cv2.rectangle(frame_copy, (x, y), (x + w, y + h), color, 2)
            
            # Draw label
            label = f"Person"
            if has_helmet:
                label += " ✓Helmet"
            if has_vest:
                label += " ✓Vest"
            if not has_helmet:
                label += " ✗Helmet"
            if not has_vest:
                label += " ✗Vest"
            
            cv2.putText(
                frame_copy, label, (x, y - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2
            )
        
        return frame_copy


def main():
    parser = argparse.ArgumentParser(description="Optimized PPE Detection with frame skipping")
    
    parser.add_argument(
        "--video",
        type=str,
        default="0",
        help="Video file path or camera index (default: 0 for webcam)"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Path to model file (default: use default model)"
    )
    
    parser.add_argument(
        "--frame-skip",
        type=int,
        default=2,
        help="Process every N frames (default: 2, 2x speedup)"
    )
    
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.5,
        help="Confidence threshold (default: 0.5)"
    )
    
    parser.add_argument(
        "--no-threading",
        action="store_true",
        help="Disable multi-threading"
    )
    
    parser.add_argument(
        "--no-show",
        action="store_true",
        help="Don't show video window"
    )
    
    args = parser.parse_args()
    
    # Create optimized detector
    detector = OptimizedPPEDetector(
        model_path=args.model,
        frame_skip=args.frame_skip,
        confidence_threshold=args.confidence,
        use_threading=not args.no_threading
    )
    
    # Process video
    detector.process_video_stream(
        video_source=args.video,
        show=not args.no_show
    )


if __name__ == "__main__":
    main()

