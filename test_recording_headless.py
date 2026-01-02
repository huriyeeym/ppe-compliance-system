"""
Headless Test for Smart Recording Strategy
No GUI required - runs in terminal only
"""

import cv2
import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from backend.ml_engine.detector import PPEDetector
from backend.ml_engine.violation_recording_strategy import SmartRecordingStrategy
from backend.utils.snapshots import SnapshotManager
from backend.utils.logger import logger


def test_recording_headless():
    """Test smart recording without GUI"""

    print("=" * 80)
    print("🎯 HEADLESS RECORDING TEST (No GUI)")
    print("=" * 80)
    print("\nThis test will:")
    print("  1. Open camera and process 300 frames (~10 seconds at 30fps)")
    print("  2. Detect persons and PPE violations")
    print("  3. Apply smart recording strategy")
    print("  4. Save snapshots to disk")
    print("  5. Show statistics")
    print("=" * 80)

    # Initialize
    print("\n📦 Initializing components...")
    detector = PPEDetector(
        enable_tracking=True,
        required_ppe=["helmet", "vest"]
    )

    strategy = SmartRecordingStrategy(
        interval_with_face_seconds=10,      # TEST: 10 sec (production: 600)
        interval_without_face_seconds=5,    # TEST: 5 sec (production: 60)
        interval_critical_seconds=3,        # TEST: 3 sec (production: 120)
        enable_session_tracking=True
    )

    snapshot_manager = SnapshotManager()

    # Open camera
    print("\n📹 Opening camera...")
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("❌ Failed to open camera")
        print("\nTrying with video file instead...")
        # Try with a test video if available
        test_video = Path("data/test_video.mp4")
        if test_video.exists():
            cap = cv2.VideoCapture(str(test_video))
        else:
            print("❌ No camera or test video available")
            return

    print("✅ Camera opened")

    # Process frames
    max_frames = 300  # ~10 seconds at 30fps
    frame_count = 0
    recordings_made = 0
    detections_count = 0
    last_print = time.time()

    print(f"\n🎬 Processing {max_frames} frames...")
    print("=" * 80)

    try:
        while frame_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                print("⚠️ Camera disconnected or end of video")
                break

            frame_count += 1

            # Run detection
            detections = detector.detect(frame)
            detections_count += len(detections)

            # Process each person
            for person in detections:
                track_id = person.get("track_id")
                is_compliant = person.get("is_compliant", True)
                severity = person.get("severity", "none")
                missing_ppe = person.get("missing_ppe", [])

                # Simulate face detection (in real system, add face detector)
                has_face = False

                # Check recording
                should_record, reason = strategy.should_record(
                    track_id=track_id,
                    is_compliant=is_compliant,
                    severity=severity,
                    missing_ppe=missing_ppe,
                    has_face=has_face
                )

                if should_record:
                    # Save snapshot
                    snapshot_path = snapshot_manager.save_snapshot(
                        frame=frame,
                        camera_id=0,
                        person_bbox=person["bbox"],
                        track_id=track_id,
                        draw_bbox=True
                    )

                    recordings_made += 1

                    # Get session info
                    session = strategy.get_active_session(track_id)
                    session_info = ""
                    if session:
                        duration = session.duration_seconds(datetime.utcnow())
                        session_info = f" (Session: {duration:.0f}s, Record #{session.record_count})"

                    print(f"\n🎬 RECORDING #{recordings_made}")
                    print(f"   Frame: {frame_count}")
                    print(f"   Track ID: {track_id}")
                    print(f"   Reason: {reason}{session_info}")
                    print(f"   Severity: {severity}")
                    print(f"   Missing PPE: {missing_ppe}")
                    print(f"   Snapshot: {snapshot_path}")

            # Progress indicator
            if time.time() - last_print > 2:  # Print every 2 seconds
                progress = (frame_count / max_frames) * 100
                print(f"\n📊 Progress: {frame_count}/{max_frames} frames ({progress:.0f}%) | Recordings: {recordings_made}")
                last_print = time.time()

            # Cleanup stale sessions periodically
            if frame_count % 100 == 0:
                strategy.cleanup_stale_sessions()

    finally:
        cap.release()

        # Final statistics
        print("\n" + "=" * 80)
        print("📊 FINAL STATISTICS")
        print("=" * 80)

        print(f"\n✅ Test completed")
        print(f"   Frames processed: {frame_count}")
        print(f"   Persons detected: {detections_count}")
        print(f"   Recordings made: {recordings_made}")

        strategy_stats = strategy.get_stats()
        print(f"\n🎯 Smart Recording Strategy:")
        print(f"   Total detections: {strategy_stats['total_detections']}")
        print(f"   Total recordings: {strategy_stats['total_recordings']}")
        print(f"   Recording rate: {strategy_stats['recording_rate_percent']}%")
        print(f"   Active sessions: {strategy_stats['active_sessions']}")

        print(f"\n📈 Efficiency:")
        naive_count = strategy_stats['total_detections']
        smart_count = strategy_stats['total_recordings']
        if naive_count > 0:
            savings = ((naive_count - smart_count) / naive_count * 100)
            print(f"   Without strategy: {naive_count} records")
            print(f"   With strategy: {smart_count} records")
            print(f"   Savings: {savings:.1f}% reduction!")

        print(f"\n🔍 Recordings by reason:")
        for reason, count in sorted(
            strategy_stats['recordings_by_reason'].items(),
            key=lambda x: x[1],
            reverse=True
        ):
            print(f"   {reason}: {count}")

        snap_stats = snapshot_manager.get_stats()
        print(f"\n💾 Snapshot storage:")
        print(f"   Total snapshots: {snap_stats['total_snapshots']}")
        print(f"   Storage used: {snap_stats['total_size_mb']} MB")
        print(f"   Location: {snap_stats['base_dir']}")

        print("\n" + "=" * 80)
        print("✅ Test completed successfully!")
        print("\nTo view snapshots:")
        print(f"   dir {snap_stats['base_dir']}")
        print("=" * 80)


if __name__ == "__main__":
    test_recording_headless()
