"""
Detection API endpoints
Handles real-time PPE detection from video frames
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from typing import List, Dict
import numpy as np
import cv2
from io import BytesIO

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
        detections = detector.detect(frame)

        logger.debug(f"Detected {len(detections)} persons in frame")

        return {
            "success": True,
            "detections": detections,
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
