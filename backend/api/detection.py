"""
Detection API endpoints
Handles real-time PPE detection from video frames
With person tracking and smart recording
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
import numpy as np
import cv2
from datetime import datetime

from backend.ml_engine.detector import PPEDetector
from backend.ml_engine.violation_recording_strategy import SmartRecordingStrategy
from backend.utils.snapshots import SnapshotManager
from backend.utils.logger import logger

router = APIRouter(prefix="/detection", tags=["Detection"])

# Global instances (lazy loaded)
_detector = None
_recording_strategy = None
_snapshot_manager = None


def get_detector() -> PPEDetector:
    """Get or create global detector instance with tracking enabled"""
    global _detector
    if _detector is None:
        logger.info("Initializing PPE Detector with tracking...")
        _detector = PPEDetector(enable_tracking=True)  # ✅ Enable tracking
        logger.info(f"Detector initialized: {_detector.get_model_info()}")
    return _detector


def get_recording_strategy() -> SmartRecordingStrategy:
    """Get or create global recording strategy"""
    global _recording_strategy
    if _recording_strategy is None:
        logger.info("Initializing Smart Recording Strategy...")
        _recording_strategy = SmartRecordingStrategy(
            interval_with_face_seconds=600,      # 10 minutes with face
            interval_without_face_seconds=60,    # 1 minute without face
            interval_critical_seconds=120,       # 2 minutes for critical
            enable_session_tracking=True
        )
        logger.info("Smart Recording Strategy initialized")
    return _recording_strategy


def get_snapshot_manager() -> SnapshotManager:
    """Get or create global snapshot manager"""
    global _snapshot_manager
    if _snapshot_manager is None:
        logger.info("Initializing Snapshot Manager...")
        _snapshot_manager = SnapshotManager()
        logger.info("Snapshot Manager initialized")
    return _snapshot_manager


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
    confidence: float = Query(0.5, ge=0.0, le=1.0),
    camera_id: int = Query(0, description="Camera ID for snapshot storage")
):
    """
    Detect PPE items in a single video frame
    WITH person tracking and smart recording

    - **file**: Image file (JPEG, PNG, etc.)
    - **confidence**: Detection confidence threshold (0.0-1.0)
    - **camera_id**: Camera ID for organizing snapshots

    Returns:
        List of person detections with PPE items + recording metadata
    """
    try:
        # Read uploaded image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Get components
        detector = get_detector()
        strategy = get_recording_strategy()
        snapshot_mgr = get_snapshot_manager()

        # Run detection WITH TRACKING
        raw_detections = detector.detect(frame)

        logger.debug(f"Detected {len(raw_detections)} persons in frame")

        formatted_detections = []
        violations_recorded = []

        for idx, det in enumerate(raw_detections):
            bbox = det.get("bbox", {})
            track_id = det.get("track_id")  # ✅ Get track ID from tracker
            ppe_items = det.get("ppe_items", []) or []
            is_compliant = det.get("is_compliant", True)
            severity = det.get("severity", "none")
            missing_ppe_list = det.get("missing_ppe", [])

            # Normalize PPE items
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

            # ✅ Check if we should record this violation
            should_record, recording_reason = strategy.should_record(
                track_id=track_id,
                is_compliant=is_compliant,
                severity=severity,
                missing_ppe=missing_ppe_list,
                has_face=False  # TODO: Add face detection
            )

            snapshot_path = None
            if should_record and not is_compliant:
                # ✅ Save snapshot to disk
                snapshot_path = snapshot_mgr.save_snapshot(
                    frame=frame,
                    camera_id=camera_id,
                    person_bbox=bbox,
                    track_id=track_id,
                    draw_bbox=True
                )

                violations_recorded.append({
                    "track_id": track_id,
                    "reason": str(recording_reason),
                    "snapshot_path": snapshot_path
                })

                logger.info(
                    f"Violation recorded: Track {track_id}, "
                    f"Reason: {recording_reason}, Snapshot: {snapshot_path}"
                )

            formatted_detections.append({
                "person_id": det.get("person_id") or idx + 1,
                "track_id": track_id,  # ✅ Include track ID
                "bbox": bbox,
                "confidence": float(det.get("confidence", 0)),
                "detected_ppe": normalized_detected,
                "missing_ppe": missing_ppe,
                "compliance": is_compliant,
                "severity": severity,
                "recorded": should_record and not is_compliant,  # ✅ Was this recorded?
                "snapshot_path": snapshot_path  # ✅ Snapshot path if recorded
            })

        # Get recording stats
        stats = strategy.get_stats()

        return {
            "success": True,
            "detections": formatted_detections,
            "violations_recorded": violations_recorded,  # ✅ List of recorded violations
            "recording_stats": {  # ✅ Overall statistics
                "total_recordings": stats["total_recordings"],
                "active_sessions": stats["active_sessions"],
                "recording_rate": stats["recording_rate_percent"]
            },
            "frame_shape": {
                "height": frame.shape[0],
                "width": frame.shape[1]
            },
            "smart_recording_enabled": True  # ✅ MARKER: New code is loaded
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
