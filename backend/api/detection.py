"""
Detection API endpoints
Handles real-time PPE detection from video frames
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
import numpy as np
import cv2

from backend.ml_engine.detector import PPEDetector
from backend.utils.logger import logger

router = APIRouter(prefix="/detection", tags=["Detection"])

# Global detector instance (lazy loaded)
_detector = None


def get_detector() -> PPEDetector:
    """Get or create global detector instance"""
    global _detector
    if _detector is None:
        logger.info("Initializing PPE Detector...")
        _detector = PPEDetector()
        logger.info(f"Detector initialized: {_detector.get_model_info()}")
    return _detector


EXPECTED_PPE = ["hard_hat", "safety_vest"]

PPE_ALIAS_MAP = {
    "helmet": "hard_hat",
    "hardhat": "hard_hat",
    "hard_hat": "hard_hat",
    "no-helmet": "no_helmet",
    "no helmet": "no_helmet",
    "nohelmet": "no_helmet",
    "vest": "safety_vest",
    "safety vest": "safety_vest",
    "no-vest": "no_safety_vest",
    "no vest": "no_safety_vest",
    "no_vest": "no_safety_vest",
}


def _normalize_ppe_type(ppe_type: str) -> str:
    """Normalize raw model class names to canonical PPE types"""
    if not ppe_type:
        return ""
    t = ppe_type.lower().strip()
    if t in PPE_ALIAS_MAP:
        return PPE_ALIAS_MAP[t]
    if "no helmet" in t:
        return "no_helmet"
    if "helmet" in t or "hard" in t:
        return "hard_hat"
    if "no vest" in t:
        return "no_safety_vest"
    if "vest" in t:
        return "safety_vest"
    if "glove" in t:
        return "gloves"
    if "boot" in t or "shoe" in t:
        return "safety_boots"
    return t


@router.post("/detect-frame")
async def detect_frame(
    file: UploadFile = File(...),
    confidence: float = Query(0.5, ge=0.0, le=1.0)
):
    """
    Detect PPE items in a single video frame

    - **file**: Image file (JPEG, PNG, etc.)
    - **confidence**: Detection confidence threshold (0.0-1.0)

    Returns:
        List of person detections with PPE items
    """
    try:
        # Read uploaded image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Get detector
        detector = get_detector()

        # Run detection
        raw_detections = detector.detect(frame)

        logger.debug(f"Detected {len(raw_detections)} persons in frame")

        formatted_detections = []
        for idx, det in enumerate(raw_detections):
            bbox = det.get("bbox", {})
            ppe_items = det.get("ppe_items", []) or []

            normalized_detected = []
            detected_types = set()

            for item in ppe_items:
                norm_type = _normalize_ppe_type(item.get("type", ""))
                if not norm_type:
                    continue
                confidence_score = float(item.get("confidence", 0))
                normalized_detected.append({
                    "type": norm_type,
                    "confidence": confidence_score,
                })
                detected_types.add(norm_type)

            missing_ppe = [
                {"type": ppe_type, "required": True}
                for ppe_type in EXPECTED_PPE
                if ppe_type not in detected_types
            ]

            formatted_detections.append({
                "person_id": det.get("person_id") or idx + 1,
                "bbox": bbox,
                "confidence": float(det.get("confidence", 0)),
                "detected_ppe": normalized_detected,
                "missing_ppe": missing_ppe,
                "compliance": len(missing_ppe) == 0,
            })

        return {
            "success": True,
            "detections": formatted_detections,
            "frame_shape": {
                "height": frame.shape[0],
                "width": frame.shape[1]
            }
        }

    except Exception as e:
        logger.error(f"Detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-info")
async def get_model_info():
    """
    Get information about the loaded detection model

    Returns:
        Model metadata and configuration
    """
    try:
        detector = get_detector()
        info = detector.get_model_info()

        return {
            "success": True,
            "model_info": info
        }
    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def detection_health():
    """
    Health check for detection service

    Returns:
        Detection service status
    """
    try:
        detector = get_detector()
        info = detector.get_model_info()

        return {
            "status": "healthy",
            "model_loaded": True,
            "model_path": info["model_path"],
            "confidence_threshold": info["confidence_threshold"]
        }
    except Exception as e:
        logger.error(f"Detection service unhealthy: {e}")
        return {
            "status": "unhealthy",
            "model_loaded": False,
            "error": str(e)
        }
