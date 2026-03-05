"""
PPE Detection Engine using YOLOv8
Handles person and PPE item detection from video frames
"""

from pathlib import Path
from typing import List, Dict, Tuple, Optional
import numpy as np
import cv2
from ultralytics import YOLO

from backend.config import settings
from backend.utils.logger import logger
from backend.ml_engine.tracker import PersonTracker
from backend.ml_engine.bbox_smoother import BoundingBoxSmoother


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
        self.required_ppe = required_ppe or ["head_helmet", "vest"]  # Default: construction
        self.enable_tracking = enable_tracking

        # PPE-specific confidence thresholds
        # Lowered thresholds for better detection (especially gloves and glasses)
        self.ppe_confidence_thresholds = {
            "head_helmet": 0.30,
            "vest": 0.25,
            "hand_glove": 0.22,  # Lowered from 0.30 - gloves are small and hard to detect
            "boots": 0.25,
            "glasses": 0.25,  # Lowered from 0.32 - glasses are very small
            "face_mask": 0.28,
            "Ear-protection": 0.25,  # Lowered - ear protection is small
            "head_nohelmet": 0.20,
            "hand_noglove": 0.20,
            "face_nomask": 0.20,
            "No_Glasses": 0.20,
            "No_Ear-Protection": 0.20,
        }

        # Load YOLO model
        logger.info(f"Loading PPE detection model: {self.model_path}")
        self.model = YOLO(str(self.model_path))

        # Initialize tracker if enabled
        self.tracker = PersonTracker() if enable_tracking else None
        
        # Initialize bounding box smoother (always enabled for stability)
        self.bbox_smoother = BoundingBoxSmoother(alpha=0.7)  # 0.7 = good balance

        logger.info("PPE Detector initialized")
        logger.info(f"Model: {self.model_path}")
        logger.info(f"Confidence threshold: {self.confidence_threshold}")
        logger.info(f"Required PPE: {self.required_ppe}")
        logger.info(f"Tracking enabled: {self.enable_tracking}")
    
    def _get_default_model_path(self) -> Path:
        """Get default model path - uses best.pt"""
        best_model = Path("best.pt")
        if best_model.exists():
            return str(best_model)

        model_file = settings.models_dir / settings.default_model
        if model_file.exists():
            return str(model_file)

        return "best.pt"
    
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
        # Dual-scale detection - balanced speed and accuracy
        all_detections = []
        conf_low = 0.12  # Lowered from 0.15 for better detection of small PPE items

        # Scale 1: Fast detection (640)
        results_640 = self.model(frame, conf=conf_low, imgsz=640, verbose=False)
        detections_640 = self._parse_results(results_640[0])
        all_detections.extend(detections_640)

        # Scale 2: Better accuracy (1280) - crucial for small items like gloves/glasses
        results_1280 = self.model(frame, conf=conf_low, imgsz=1280, verbose=False)
        detections_1280 = self._parse_results(results_1280[0])
        all_detections.extend(detections_1280)

        # Remove duplicates
        all_detections = self._remove_duplicates(all_detections, iou_threshold=0.5)

        # Filter PPE
        all_detections = self._filter_ppe_detections(all_detections)

        # Group PPE items with persons
        detections = self._group_ppe_with_persons(all_detections)

        # Check compliance for each person
        detections = self._check_compliance(detections)

        # Add tracking IDs if tracking is enabled
        if self.tracker is not None:
            detections = self.tracker.update(detections)
        
        # Smooth bounding boxes to reduce jitter (stabilize positions)
        for det in detections:
            if "bbox" in det and "track_id" in det:
                det["bbox"] = self.bbox_smoother.smooth(det["track_id"], det["bbox"])

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

        # Check if any detections were found
        if result.boxes is None or len(result.boxes) == 0:
            return detections  # Return empty list if no detections

        try:
            # Extract boxes, classes, and confidences with safety checks
            boxes = result.boxes.xyxy
            classes = result.boxes.cls
            confidences = result.boxes.conf

            # Safety check: ensure all required tensors exist
            if boxes is None or classes is None or confidences is None:
                logger.warning("Missing required detection tensors (boxes/cls/conf is None)")
                return detections

            # Convert to numpy
            boxes = boxes.cpu().numpy()  # [x1, y1, x2, y2]
            classes = classes.cpu().numpy()  # class indices
            confidences = confidences.cpu().numpy()  # confidence scores

            # Get class names (handle case where names might be missing)
            class_names = getattr(result, 'names', None) or {}

            for box, cls, conf in zip(boxes, classes, confidences):
                x1, y1, x2, y2 = box
                cls_int = int(cls)

                # Get class name or use class ID as fallback
                class_name = class_names.get(cls_int, f"class_{cls_int}") if class_names else f"class_{cls_int}"

                detection = {
                    "class": class_name,
                    "class_id": cls_int,
                    "confidence": float(conf),
                    "bbox": {
                        "x": int(x1),
                        "y": int(y1),
                        "w": int(x2 - x1),
                        "h": int(y2 - y1)
                    }
                }
                detections.append(detection)

        except Exception as e:
            logger.error(f"Error parsing YOLO results: {e}")
            logger.error(f"Result type: {type(result)}, boxes type: {type(result.boxes) if hasattr(result, 'boxes') else 'N/A'}")
            return detections

        return detections

    def _filter_ppe_detections(self, detections: List[Dict]) -> List[Dict]:
        """Filter PPE detections using class-specific confidence thresholds"""
        filtered = []
        for det in detections:
            class_name = det["class"]
            confidence = det["confidence"]

            if class_name == "person":
                if confidence >= 0.25:
                    filtered.append(det)
                continue

            ppe_threshold = self.ppe_confidence_thresholds.get(class_name, 0.30)
            if confidence >= ppe_threshold:
                filtered.append(det)

        return filtered

    def _remove_duplicates(self, detections: List[Dict], iou_threshold: float = 0.5) -> List[Dict]:
        """Remove duplicate detections using NMS"""
        if not detections:
            return []

        by_class = {}
        for det in detections:
            cls = det["class"]
            if cls not in by_class:
                by_class[cls] = []
            by_class[cls].append(det)

        filtered = []
        for cls, dets in by_class.items():
            dets = sorted(dets, key=lambda x: x["confidence"], reverse=True)
            keep = []
            while dets:
                best = dets.pop(0)
                keep.append(best)
                dets = [d for d in dets if self._calculate_iou(best["bbox"], d["bbox"]) < iou_threshold]
            filtered.extend(keep)

        return filtered

    def _calculate_iou(self, box1: Dict, box2: Dict) -> float:
        """Calculate IoU between two bounding boxes"""
        x1 = max(box1["x"], box2["x"])
        y1 = max(box1["y"], box2["y"])
        x2 = min(box1["x"] + box1["w"], box2["x"] + box2["w"])
        y2 = min(box1["y"] + box1["h"], box2["y"] + box2["h"])

        if x2 < x1 or y2 < y1:
            return 0.0

        intersection = (x2 - x1) * (y2 - y1)
        area1 = box1["w"] * box1["h"]
        area2 = box2["w"] * box2["h"]
        union = area1 + area2 - intersection

        return intersection / union if union > 0 else 0.0

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
                # Use lower threshold (0.3) for better PPE association
                # Small items like gloves and glasses may only partially overlap
                if self._is_inside(ppe["bbox"], person["bbox"], threshold=0.3):
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
        Check PPE compliance using STRICT logic - NO benefit of doubt
        """
        negative_indicators = {
            "head_helmet": ["head_nohelmet"],
            "vest": [],
            "hand_glove": ["hand_noglove"],
            "face_mask": ["face_nomask"],
            "glasses": ["No_Glasses"],
            "Ear-protection": ["No_Ear-Protection"]
        }

        for person in detections:
            detected_ppe_types = [item["type"] for item in person.get("ppe_items", [])]
            missing_ppe = []

            for ppe_type in self.required_ppe:
                positive_detected = ppe_type in detected_ppe_types
                negative_classes = negative_indicators.get(ppe_type, [])
                negative_detected = any(neg_class in detected_ppe_types for neg_class in negative_classes)

                # STRICT: if positive detected = present, else = missing
                if positive_detected:
                    pass  # Present
                elif negative_detected:
                    missing_ppe.append(ppe_type)
                else:
                    missing_ppe.append(ppe_type)  # Strict: not detected = missing

            total_required = len(self.required_ppe)
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

