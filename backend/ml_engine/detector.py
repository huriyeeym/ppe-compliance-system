"""
PPE Detection Engine using YOLOv8
Handles person and PPE item detection from video frames
"""

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import numpy as np
from ultralytics import YOLO

from backend.config import settings


class PPEDetector:
    """
    YOLO-based PPE detection engine
    
    Detects:
    - Person (bounding box)
    - PPE items (helmet, vest, gloves, etc.)
    
    Usage:
        detector = PPEDetector()
        detections = detector.detect(frame)
    """
    
    def __init__(self, model_path: Optional[str] = None, confidence_threshold: float = None):
        """
        Initialize PPE detector
        
        Args:
            model_path: Path to YOLO model (.pt file). If None, uses default from config
            confidence_threshold: Minimum confidence for detection (0.0-1.0)
        """
        self.model_path = model_path or self._get_default_model_path()
        self.confidence_threshold = confidence_threshold or settings.confidence_threshold
        
        # Load YOLO model
        self.model = self._load_model()
        
        print(f"✅ PPE Detector initialized")
        print(f"   Model: {self.model_path}")
        print(f"   Confidence threshold: {self.confidence_threshold}")
    
    def _get_default_model_path(self) -> Path:
        """Get default model path from config"""
        model_file = settings.models_dir / settings.default_model
        
        # If model doesn't exist, use pre-trained YOLOv8
        if not model_file.exists():
            print(f"⚠️  Custom model not found: {model_file}")
            print(f"   Using YOLOv8 pre-trained model (will download if needed)")
            return "yolov8n.pt"  # Nano model (fastest)
        
        return str(model_file)
    
    def _load_model(self) -> YOLO:
        """Load YOLO model"""
        try:
            model = YOLO(self.model_path)
            return model
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            print(f"   Falling back to YOLOv8 pre-trained")
            return YOLO("yolov8n.pt")
    
    def detect(self, frame: np.ndarray) -> List[Dict]:
        """
        Detect persons and PPE items in a frame
        
        Args:
            frame: Image frame (numpy array, BGR format from OpenCV)
        
        Returns:
            List of detections:
            [
                {
                    "class": "person",
                    "confidence": 0.95,
                    "bbox": {"x": 100, "y": 200, "w": 50, "h": 100},
                    "ppe_items": [...]  # PPE items within person bbox
                },
                ...
            ]
        """
        # Run YOLO inference
        results = self.model(frame, conf=self.confidence_threshold, verbose=False)
        
        # Parse results
        detections = self._parse_results(results[0])
        
        # Group PPE items with persons
        detections = self._group_ppe_with_persons(detections)
        
        return detections
    
    def _parse_results(self, result) -> List[Dict]:
        """
        Parse YOLO results into structured format
        
        Args:
            result: YOLO result object
        
        Returns:
            List of detections with bbox and class info
        """
        detections = []
        
        # Extract boxes, classes, and confidences
        boxes = result.boxes.xyxy.cpu().numpy()  # [x1, y1, x2, y2]
        classes = result.boxes.cls.cpu().numpy()  # class indices
        confidences = result.boxes.conf.cpu().numpy()  # confidence scores
        
        for box, cls, conf in zip(boxes, classes, confidences):
            x1, y1, x2, y2 = box
            
            detection = {
                "class": result.names[int(cls)],  # class name
                "class_id": int(cls),
                "confidence": float(conf),
                "bbox": {
                    "x": int(x1),
                    "y": int(y1),
                    "w": int(x2 - x1),
                    "h": int(y2 - y1)
                }
            }
            detections.append(detection)
        
        return detections
    
    def _group_ppe_with_persons(self, detections: List[Dict]) -> List[Dict]:
        """
        Group PPE items with detected persons
        
        Logic:
        - Find all person detections
        - For each person, find PPE items inside their bounding box
        - Return structured data with person + their PPE items
        
        Args:
            detections: Flat list of all detections
        
        Returns:
            List of person detections with nested PPE items
        """
        # Separate persons and PPE items
        persons = [d for d in detections if d["class"] == "person"]
        ppe_items = [d for d in detections if d["class"] != "person"]
        
        # For each person, find overlapping PPE items
        for person in persons:
            person["ppe_items"] = []
            
            for ppe in ppe_items:
                if self._is_inside(ppe["bbox"], person["bbox"]):
                    person["ppe_items"].append({
                        "type": ppe["class"],
                        "confidence": ppe["confidence"]
                    })
        
        return persons
    
    def _is_inside(self, inner_bbox: Dict, outer_bbox: Dict, threshold: float = 0.5) -> bool:
        """
        Check if inner bbox is inside outer bbox (with overlap threshold)
        
        Args:
            inner_bbox: PPE item bbox
            outer_bbox: Person bbox
            threshold: Minimum overlap ratio (0.0-1.0)
        
        Returns:
            True if inner bbox overlaps outer bbox by at least threshold
        """
        # Calculate intersection
        x1 = max(inner_bbox["x"], outer_bbox["x"])
        y1 = max(inner_bbox["y"], outer_bbox["y"])
        x2 = min(
            inner_bbox["x"] + inner_bbox["w"],
            outer_bbox["x"] + outer_bbox["w"]
        )
        y2 = min(
            inner_bbox["y"] + inner_bbox["h"],
            outer_bbox["y"] + outer_bbox["h"]
        )
        
        # No intersection
        if x2 < x1 or y2 < y1:
            return False
        
        # Calculate overlap ratio
        intersection_area = (x2 - x1) * (y2 - y1)
        inner_area = inner_bbox["w"] * inner_bbox["h"]
        
        overlap_ratio = intersection_area / inner_area if inner_area > 0 else 0
        
        return overlap_ratio >= threshold
    
    def detect_batch(self, frames: List[np.ndarray]) -> List[List[Dict]]:
        """
        Detect in multiple frames (batch processing for efficiency)
        
        Args:
            frames: List of image frames
        
        Returns:
            List of detection results (one per frame)
        """
        results = self.model(frames, conf=self.confidence_threshold, verbose=False)
        
        batch_detections = []
        for result in results:
            detections = self._parse_results(result)
            detections = self._group_ppe_with_persons(detections)
            batch_detections.append(detections)
        
        return batch_detections
    
    def get_model_info(self) -> Dict:
        """Get model information"""
        return {
            "model_path": str(self.model_path),
            "model_type": self.model.type,
            "confidence_threshold": self.confidence_threshold,
            "class_names": self.model.names if hasattr(self.model, 'names') else {}
        }


# Convenience function for single frame detection
def detect_ppe(frame: np.ndarray, confidence: float = 0.5) -> List[Dict]:
    """
    Convenience function for quick detection
    
    Args:
        frame: Image frame (numpy array)
        confidence: Confidence threshold
    
    Returns:
        List of person detections with PPE items
    """
    detector = PPEDetector(confidence_threshold=confidence)
    return detector.detect(frame)

