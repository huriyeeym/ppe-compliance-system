"""
PPE Detection Engine using YOLOv8
Handles person and PPE item detection from video frames
"""

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import numpy as np
from ultralytics import YOLO

from backend.config import settings
from backend.utils.logger import logger
from backend.ml_engine.tracker import PersonTracker


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
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: float = None,
        required_ppe: Optional[List[str]] = None,
        enable_tracking: bool = False
    ):
        """
        Initialize PPE detector

        Args:
            model_path: Path to YOLO model (.pt file). If None, uses default from config
            confidence_threshold: Minimum confidence for detection (0.0-1.0)
            required_ppe: List of required PPE types for compliance checking
                         e.g., ["helmet", "vest"] for construction
                         If None, uses default for construction domain
            enable_tracking: Enable person tracking across frames (default: False)
        """
        self.model_path = model_path or self._get_default_model_path()
        self.confidence_threshold = confidence_threshold or settings.confidence_threshold
        self.required_ppe = required_ppe or ["helmet", "vest"]  # Default: construction
        self.enable_tracking = enable_tracking

        # Load YOLO model
        self.model = self._load_model()

        # Initialize tracker if enabled
        self.tracker = PersonTracker() if enable_tracking else None

        logger.info("PPE Detector initialized")
        logger.info(f"Model: {self.model_path}")
        logger.info(f"Confidence threshold: {self.confidence_threshold}")
        logger.info(f"Required PPE: {self.required_ppe}")
        logger.info(f"Tracking enabled: {self.enable_tracking}")
    
    def _get_default_model_path(self) -> Path:
        """Get default model path from config"""
        model_file = settings.models_dir / settings.default_model
        
        # If model doesn't exist, use pre-trained YOLOv8
        if not model_file.exists():
            logger.warning(f"Custom model not found: {model_file}")
            logger.info("Using YOLOv8 pre-trained model (will download if needed)")
            return "yolov8n.pt"  # Nano model (fastest)
        
        return str(model_file)
    
    def _load_model(self) -> YOLO:
        """Load YOLO model"""
        try:
            model = YOLO(self.model_path)
            return model
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            logger.info("Falling back to YOLOv8 pre-trained")
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
                    "track_id": 1,  # Unique ID across frames (if tracking enabled)
                    "ppe_items": [...],  # PPE items detected on person
                    "missing_ppe": [...],  # PPE items missing
                    "is_compliant": True/False,  # Overall compliance
                    "compliance_score": 1.0,  # 0.0-1.0
                    "severity": "none"  # none, warning, critical
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

        # Check compliance for each person
        detections = self._check_compliance(detections)

        # Add tracking IDs if tracking is enabled
        if self.tracker is not None:
            detections = self.tracker.update(detections)

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

    def _check_compliance(self, detections: List[Dict]) -> List[Dict]:
        """
        Check PPE compliance for each person

        For each person, checks if all required PPE items are present.
        Calculates compliance score, missing items, and violation severity.

        Args:
            detections: List of person detections with ppe_items

        Returns:
            Enhanced detections with compliance information:
            - missing_ppe: List of missing PPE types
            - is_compliant: Boolean (True if all PPE present)
            - compliance_score: Float 0.0-1.0 (percentage of PPE present)
            - severity: String "none", "warning", or "critical"
        """
        for person in detections:
            # Get list of detected PPE types for this person
            detected_ppe_types = [item["type"] for item in person.get("ppe_items", [])]

            # Find missing PPE
            missing_ppe = [
                ppe_type
                for ppe_type in self.required_ppe
                if ppe_type not in detected_ppe_types
            ]

            # Calculate compliance
            total_required = len(self.required_ppe)
            total_detected = len(detected_ppe_types)

            person["missing_ppe"] = missing_ppe
            person["is_compliant"] = len(missing_ppe) == 0
            person["compliance_score"] = (
                (total_required - len(missing_ppe)) / total_required
                if total_required > 0
                else 1.0
            )

            # Determine severity
            if len(missing_ppe) == 0:
                person["severity"] = "none"
            elif len(missing_ppe) == total_required:
                # All PPE missing - critical
                person["severity"] = "critical"
            else:
                # Some PPE missing - warning
                person["severity"] = "warning"

        return detections

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
            detections = self._check_compliance(detections)  # Add compliance checking
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

