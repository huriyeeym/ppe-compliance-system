"""
Detection API endpoints
Handles real-time PPE detection from video frames
With person tracking and smart recording
"""

from fastapi import APIRouter, File, UploadFile, HTTPException, Query, Depends
import numpy as np
import cv2
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession

from backend.ml_engine.detector import PPEDetector
from backend.ml_engine.model_registry import get_registry
from backend.ml_engine.violation_recording_strategy import SmartRecordingStrategy, RecordingReason
from backend.utils.snapshots import SnapshotManager
from backend.utils.video_recorder import VideoRecorder
from backend.utils.logger import logger
from backend.database.connection import get_db
from backend.database import schemas, crud
from backend.services.violation_service import ViolationService

router = APIRouter(prefix="/detection", tags=["Detection"])

# Global instances (lazy loaded)
# Domain-specific detector cache: {domain_type: PPEDetector}
_detectors: dict[str, PPEDetector] = {}
_default_detector = None
_recording_strategy = None
_snapshot_manager = None
_video_recorder = None


def get_detector(domain_type: str = None, required_ppe: list = None) -> PPEDetector:
    """
    Get or create detector instance for a specific domain

    Each domain gets its OWN detector instance with separate:
    - Tracker (person IDs are domain-specific)
    - Bbox smoother (separate smoothing per domain)
    - Required PPE rules

    This ensures complete isolation between domains (microservice approach)

    Args:
        domain_type: Domain type (e.g., "construction", "manufacturing", etc.)
                    If None, uses default detector
        required_ppe: List of required PPE model class names (e.g., ["head_helmet", "vest"])
                     If None, uses default for domain

    Returns:
        PPEDetector instance configured for the domain
    """
    global _detectors, _default_detector

    # Use domain_type as cache key (one detector per domain)
    # Each domain must have its own detector for isolation
    cache_key = domain_type if domain_type else "default"

    # If no domain specified, use default detector
    if domain_type is None:
        if _default_detector is None:
            logger.info("Initializing default PPE Detector with tracking...")
            _default_detector = PPEDetector(enable_tracking=True, required_ppe=required_ppe)
            logger.info(f"Default detector initialized: {_default_detector.get_model_info()}")
        return _default_detector

    # Get domain-specific detector (create if doesn't exist)
    if cache_key not in _detectors:
        logger.info(f"[DETECTOR INIT] Creating NEW detector for domain: {domain_type}")
        logger.info(f"[DETECTOR INIT] Required PPE: {required_ppe}")

        # Get model path from registry
        registry = get_registry()
        model_path = registry.get_model_for_domain(domain_type)

        if model_path:
            logger.info(f"[DETECTOR INIT] Using domain-specific model: {model_path}")
            _detectors[cache_key] = PPEDetector(
                model_path=str(model_path),
                enable_tracking=True,
                required_ppe=required_ppe
            )
        else:
            logger.info(f"[DETECTOR INIT] No specific model for {domain_type}, using default best.pt")
            _detectors[cache_key] = PPEDetector(
                enable_tracking=True,
                required_ppe=required_ppe
            )

        logger.info(f"[DETECTOR INIT] ✓ Detector created for {domain_type}")
    else:
        # Detector exists - update required_ppe if changed
        existing_detector = _detectors[cache_key]
        if existing_detector.required_ppe != required_ppe:
            logger.info(f"[DETECTOR UPDATE] Updating required PPE for {domain_type}")
            logger.info(f"[DETECTOR UPDATE] Old: {existing_detector.required_ppe}")
            logger.info(f"[DETECTOR UPDATE] New: {required_ppe}")
            existing_detector.required_ppe = required_ppe

    return _detectors[cache_key]


def get_recording_strategy() -> SmartRecordingStrategy:
    """Get or create global recording strategy"""
    global _recording_strategy
    if _recording_strategy is None:
        logger.info("Initializing Smart Recording Strategy...")
        _recording_strategy = SmartRecordingStrategy(
            interval_with_face_seconds=900,      # 15 minutes with face (storage tasarrufu)
            interval_without_face_seconds=300,   # 5 minutes without face (endüstri standardı)
            interval_critical_seconds=180,       # 3 minutes for critical (dengeli)
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


def get_video_recorder() -> VideoRecorder:
    """Get or create global video recorder"""
    global _video_recorder
    if _video_recorder is None:
        logger.info("Initializing Video Recorder...")
        _video_recorder = VideoRecorder(
            buffer_duration_seconds=30,  # Son 30 saniyeyi tut
            fps=30.0,
            video_quality=23  # H.264 CRF (good quality)
        )
        logger.info("Video Recorder initialized")
    return _video_recorder


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
    camera_id: int = Query(0, description="Camera ID for snapshot storage"),
    domain_id: int = Query(None, description="Domain ID for violation recording"),
    db: AsyncSession = Depends(get_db)
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

        # DEBUG: Log incoming frame size
        logger.info(f"[FRAME] Received frame size: {frame.shape} (H x W x C)")

        # Get domain type and required PPE from CAMERA (not from request parameter!)
        # The camera knows which domain it belongs to - CRITICAL for correct detection
        domain_type = None
        required_ppe = None
        actual_domain_id = None

        if camera_id and camera_id > 0:
            # Get camera from database to find its domain
            camera = await crud.get_camera_by_id(db, camera_id)
            if camera and camera.domain_id:
                actual_domain_id = camera.domain_id
                domain = await crud.get_domain_by_id(db, actual_domain_id)
                if domain:
                    domain_type = domain.type
                    logger.info(f"Camera {camera_id} ({camera.name}) is in domain: {domain_type} (domain_id={actual_domain_id})")
                else:
                    logger.warning(f"Domain {actual_domain_id} not found for camera {camera_id}")
            else:
                logger.warning(f"Camera {camera_id} has no domain assigned")
        elif domain_id:
            # Fallback: If no camera_id, use domain_id from request (for testing)
            actual_domain_id = domain_id
            domain = await crud.get_domain_by_id(db, domain_id)
            if domain:
                domain_type = domain.type
                logger.info(f"Using domain from request parameter: {domain_type} (domain_id={domain_id})")

        # Get required PPE rules for the domain
        if actual_domain_id:
            rules = await crud.get_domain_rules(db, actual_domain_id)
            required_rules = [r for r in rules if r.is_required]
            if required_rules:
                # Map PPE type names to best.pt model class names
                # best.pt model classes: head_helmet, vest, boots, hand_glove, glasses, face_mask, Ear-protection, etc.
                ppe_to_model_map = {
                    "hard_hat": "head_helmet",
                    "safety_vest": "vest",
                    "safety_boots": "boots",
                    "face_mask": "face_mask",
                    "gloves": "hand_glove",
                    "safety_glasses": "glasses",
                    "ear_protection": "Ear-protection",
                    "safety_goggles": "glasses"  # Added for manufacturing
                }
                required_ppe = []
                for rule in required_rules:
                    if rule.ppe_type:
                        ppe_name = rule.ppe_type.name
                        # First try the model_class_name from database (most accurate)
                        model_class = rule.ppe_type.model_class_name
                        # If not set in DB, try the mapping
                        if not model_class:
                            model_class = ppe_to_model_map.get(ppe_name, ppe_name)
                        # Skip PPE types not supported by this model (None values)
                        if model_class is not None:
                            required_ppe.append(model_class)
                            logger.info(f"  - Mapped {ppe_name} -> {model_class}")

                # Remove duplicates
                required_ppe = list(set(required_ppe))
                logger.info(f"Required PPE for {domain_type}: {required_ppe}")

        # Get domain-specific detector with required PPE
        detector = get_detector(domain_type=domain_type, required_ppe=required_ppe)
        strategy = get_recording_strategy()
        snapshot_mgr = get_snapshot_manager()
        video_recorder = get_video_recorder()

        # ✅ Add frame to video buffer (for violation recording)
        video_recorder.add_frame(frame, timestamp=datetime.utcnow())

        # Run detection WITH TRACKING
        raw_detections = detector.detect(frame)

        logger.info(f"[STEP 1] Raw detections returned: {len(raw_detections)} items")
        logger.info(f"[STEP 2] Detection types: {[type(d) for d in raw_detections]}")

        formatted_detections = []
        violations_recorded = []

        for idx, det in enumerate(raw_detections):
            logger.info(f"[STEP 3] Processing detection {idx}: type={type(det)}, value={det}")
            bbox = det.get("bbox", {})
            track_id = det.get("track_id")  # ✅ Get track ID from tracker
            ppe_items = det.get("ppe_items", []) or []
            is_compliant = det.get("is_compliant", True)
            severity = det.get("severity", "none")
            missing_ppe_list = det.get("missing_ppe", [])

            # Filter and normalize PPE items - ONLY show relevant PPE for this domain
            # Example: Construction domain only cares about head_helmet and vest
            # Don't show gloves, glasses, mask etc. on the UI for construction
            normalized_detected = []
            relevant_ppe_types = set(required_ppe) if required_ppe else set()

            for item in ppe_items:
                ppe_type = item.get("type", "")
                confidence_score = float(item.get("confidence", 0))

                # ONLY include PPE that is relevant to this domain (required_ppe)
                # Skip irrelevant PPE (e.g., don't show glasses in construction domain)
                if ppe_type in relevant_ppe_types:
                    normalized_detected.append({
                        "type": ppe_type,
                        "confidence": confidence_score,
                    })

            # Use missing_ppe from detector (already calculated with correct domain rules)
            missing_ppe = [
                {"type": ppe_type, "required": True}
                for ppe_type in missing_ppe_list
            ]

            # ✅ Check if we should record this violation
            should_record, recording_reason = strategy.should_record(
                track_id=track_id,
                is_compliant=is_compliant,
                severity=severity,
                missing_ppe=missing_ppe_list,
                has_face=False  # TODO: Add face detection
            )

            # ✅ DEBUG: Log recording decision
            logger.info(
                f"[VIOLATION CHECK] Track {track_id}: "
                f"is_compliant={is_compliant}, should_record={should_record}, "
                f"reason={recording_reason}, camera_id={camera_id}, domain_id={domain_id}, "
                f"missing_ppe={missing_ppe_list}"
            )

            snapshot_path = None
            video_path = None
            violation_id = None
            if should_record and not is_compliant:
                # ✅ Save snapshot to disk
                snapshot_path = snapshot_mgr.save_snapshot(
                    frame=frame,
                    camera_id=camera_id,
                    person_bbox=bbox,
                    track_id=track_id,
                    draw_bbox=True
                )

                # ✅ Save video segment ONLY for specific reasons (not every interval)
                # Video kaydı sadece önemli durumlarda yapılmalı:
                # - İlk violation (FIRST_DETECTION)
                # - Durum değişikliği (STATUS_CHANGE)
                # - Severity değişikliği (SEVERITY_CHANGE)
                # - Aralıklı kayıt (INTERVAL_ELAPSED) - sadece critical için
                # NOT: Her interval'da video kaydı yapılmaz (storage tasarrufu)
                recording_reason_str = str(recording_reason) if recording_reason else ""
                should_save_video = (
                    recording_reason_str == RecordingReason.FIRST_DETECTION.value or
                    recording_reason_str == RecordingReason.STATUS_CHANGE.value or
                    recording_reason_str == RecordingReason.SEVERITY_CHANGE.value or
                    (recording_reason_str == RecordingReason.INTERVAL_ELAPSED.value and severity == "critical")
                )
                
                if should_save_video:
                    try:
                        video_path = video_recorder.save_video_segment(
                            camera_id=camera_id,
                            track_id=track_id,
                            seconds_before=10.0,  # 10 saniye öncesi
                            seconds_after=5.0,    # 5 saniye sonrası
                            timestamp=datetime.utcnow(),
                            draw_bbox=bbox
                        )
                        if video_path:
                            logger.info(f"Video segment saved: {video_path} (reason: {recording_reason})")
                    except Exception as e:
                        logger.error(f"Failed to save video segment: {e}")
                        # Continue even if video save fails

                # ✅ Save violation to database if camera_id and actual_domain_id provided
                if camera_id and camera_id > 0 and actual_domain_id and actual_domain_id > 0:
                    try:
                        violation_service = ViolationService(db)
                        
                        # Map detector severity to schema severity
                        # Detector returns: "none", "warning", "critical"
                        # Schema expects: "critical", "high", "medium", "low"
                        severity_mapping = {
                            "none": "medium",
                            "warning": "low",  # warning = low severity
                            "critical": "critical"
                        }
                        mapped_severity = severity_mapping.get(severity, "medium")
                        
                        # ✅ Face Recognition: Try to match user from snapshot
                        detected_user_id = None
                        face_match_confidence = None
                        if snapshot_path:
                            logger.info(f"[FACE RECOGNITION] Starting face matching for violation snapshot: {snapshot_path}")
                            try:
                                # Get organization_id from camera
                                camera = await crud.get_camera_by_id(db, camera_id)
                                if camera and camera.organization_id:
                                    logger.info(f"[FACE RECOGNITION] Camera found: id={camera_id}, organization_id={camera.organization_id}")
                                    # Try to import FaceRecognitionService - make it optional
                                    try:
                                        from backend.services.face_recognition_service import FaceRecognitionService
                                        from backend.config import settings
                                        
                                        logger.info("[FACE RECOGNITION] FaceRecognitionService imported successfully")
                                        face_service = FaceRecognitionService()
                                        # Construct full snapshot path
                                        snapshot_full_path = settings.data_dir / snapshot_path if not Path(snapshot_path).is_absolute() else Path(snapshot_path)
                                        
                                        logger.info(f"[FACE RECOGNITION] Attempting to find matching user for snapshot: {snapshot_full_path}")
                                        match_result = await face_service.find_matching_user(
                                            violation_snapshot_path=str(snapshot_full_path),
                                            organization_id=camera.organization_id,
                                            db=db
                                        )
                                        
                                        if match_result:
                                            detected_user_id, face_match_confidence = match_result
                                            logger.info(
                                                f"[FACE MATCH] ✅ Violation matched to user {detected_user_id} "
                                                f"with confidence {face_match_confidence:.3f}"
                                            )
                                        else:
                                            logger.info("[FACE RECOGNITION] No matching user found for violation snapshot")
                                    except ImportError as e:
                                        # Face recognition not available, skip matching
                                        logger.debug(f"[FACE RECOGNITION] Service not available: {str(e)}")
                                    except Exception as e:
                                        # Log error but continue with violation creation
                                        logger.warning(f"[FACE RECOGNITION] Matching failed: {str(e)}", exc_info=True)
                                else:
                                    logger.warning(f"[FACE RECOGNITION] Camera not found or missing organization_id: camera_id={camera_id}")
                            except Exception as e:
                                logger.warning(f"[FACE RECOGNITION] Error during face recognition matching: {str(e)}", exc_info=True)
                        else:
                            logger.debug("[FACE RECOGNITION] No snapshot path available, skipping face matching")
                        
                        # Prepare violation data
                        violation_data = schemas.ViolationCreate(
                            camera_id=camera_id,
                            domain_id=actual_domain_id,  # Use camera's domain, not request parameter
                            person_bbox=bbox,
                            detected_ppe=normalized_detected,
                            missing_ppe=missing_ppe,
                            confidence=float(det.get("confidence", 0)),
                            severity=mapped_severity,
                            snapshot_path=snapshot_path,
                            video_path=video_path,  # ✅ Include video path
                            track_id=track_id,
                            detected_user_id=detected_user_id,  # ✅ Face recognition match
                            face_match_confidence=face_match_confidence  # ✅ Match confidence
                        )
                        
                        # Create violation in database
                        violation = await violation_service.create_violation(violation_data)
                        violation_id = violation.id
                        
                        logger.info(
                            f"[VIOLATION SAVED] Violation {violation_id} saved to database: Track {track_id}, "
                            f"Reason: {recording_reason}, Snapshot: {snapshot_path}, Video: {video_path}"
                        )
                        
                        # ✅ Broadcast violation via WebSocket for real-time notifications
                        try:
                            from backend.api.websocket import manager
                            # Convert violation to dict for WebSocket broadcast
                            violation_dict = {
                                "id": violation.id,
                                "camera_id": violation.camera_id,
                                "domain_id": violation.domain_id,
                                "severity": violation.severity.value if hasattr(violation.severity, 'value') else str(violation.severity),
                                "missing_ppe": missing_ppe,  # Use the already-prepared missing_ppe list
                                "timestamp": violation.timestamp.isoformat() if hasattr(violation.timestamp, 'isoformat') else str(violation.timestamp),
                                "snapshot_path": violation.snapshot_path,
                                "video_path": violation.video_path,
                                "track_id": violation.track_id if hasattr(violation, 'track_id') else track_id,
                            }
                            await manager.broadcast_violation(violation_dict)
                            logger.debug(f"[WEBSOCKET] Broadcasted violation {violation_id} to connected clients")
                        except Exception as ws_error:
                            # Don't fail violation save if WebSocket broadcast fails
                            logger.warning(f"[WEBSOCKET] Failed to broadcast violation {violation_id}: {ws_error}")
                    except Exception as e:
                        logger.error(f"[VIOLATION SAVE ERROR] Failed to save violation to database: {e}")
                        import traceback
                        logger.error(f"[VIOLATION SAVE ERROR] Traceback: {traceback.format_exc()}")
                        # Continue even if database save fails
                else:
                    logger.warning(
                        f"[VIOLATION SKIP] Skipping violation save: "
                        f"camera_id={camera_id}, actual_domain_id={actual_domain_id} "
                        f"(both must be > 0)"
                    )

                violations_recorded.append({
                    "track_id": track_id,
                    "reason": str(recording_reason),
                    "snapshot_path": snapshot_path,
                    "video_path": video_path,  # ✅ Include video path
                    "violation_id": violation_id  # Include violation ID if saved
                })

                logger.info(
                    f"Violation recorded: Track {track_id}, "
                    f"Reason: {recording_reason}, Snapshot: {snapshot_path}, Video: {video_path}"
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
        import traceback
        logger.error(f"Detection failed: {e}")
        logger.error(f"Traceback:\n{traceback.format_exc()}")
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
