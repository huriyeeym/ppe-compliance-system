"""
Test Smart Recording Strategy
Demonstrates professional-grade violation recording with adaptive intervals
"""

import cv2
import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from backend.ml_engine.detector import PPEDetector
from backend.ml_engine.violation_recording_strategy import SmartRecordingStrategy, RecordingReason
from backend.utils.snapshots import SnapshotManager
from backend.utils.logger import logger


def test_smart_recording():
    """Test smart recording strategy with professional features"""

    print("=" * 80)
    print("🎯 PROFESSIONAL VIOLATION RECORDING TEST")
    print("=" * 80)
    print("\nFeatures:")
    print("  ✅ Person tracking across frames")
    print("  ✅ Smart adaptive intervals:")
    print("     - With face detection: 10 minutes between records")
    print("     - Without face: 1 minute between records")
    print("     - Critical violations: 2 minutes")
    print("  ✅ Session tracking (entry, updates, exit)")
    print("  ✅ Status change detection (compliant ↔ violating)")
    print("=" * 80)

    # Initialize components
    print("\n1️⃣ Initializing detector with tracking...")
    detector = PPEDetector(
        enable_tracking=True,
        required_ppe=["helmet", "vest"]
    )

    print("\n2️⃣ Initializing smart recording strategy...")
    # Use shorter intervals for testing (normally 10min, 1min, 2min)
    strategy = SmartRecordingStrategy(
        interval_with_face_seconds=30,      # TEST: 30 sec (normally 600 = 10 min)
        interval_without_face_seconds=10,   # TEST: 10 sec (normally 60 = 1 min)
        interval_critical_seconds=15,       # TEST: 15 sec (normally 120 = 2 min)
        enable_session_tracking=True
    )

    print("\n3️⃣ Initializing snapshot manager...")
    snapshot_manager = SnapshotManager()

    # Open camera
    print("\n4️⃣ Opening camera...")
    camera_id = 0
    cap = cv2.VideoCapture(camera_id)

    if not cap.isOpened():
        print("❌ Failed to open camera")
        return

    print(f"✅ Camera opened: {camera_id}")

    frame_count = 0
    recordings_made = 0
    last_cleanup = time.time()

    print("\n5️⃣ Starting detection...")
    print("\nInstructions:")
    print("  - Stand WITHOUT helmet/vest to trigger violations")
    print("  - Watch recording intervals in action:")
    print("    • First detection → Immediate record")
    print("    • No face → Record every 10 seconds")
    print("    • Status change → Immediate record")
    print("  - Press 'q' to quit")
    print("  - Press 's' to show statistics")
    print("\n" + "=" * 80)

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1

            # Run detection with tracking
            detections = detector.detect(frame)

            # Process each person
            for person in detections:
                track_id = person.get("track_id")
                is_compliant = person.get("is_compliant", True)
                severity = person.get("severity", "none")
                missing_ppe = person.get("missing_ppe", [])

                # TODO: In real system, add face detection here
                # For now, simulate: has_face = False (testing fast intervals)
                has_face = False

                # Check if we should record this violation
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
                        camera_id=camera_id,
                        person_bbox=person["bbox"],
                        track_id=track_id,
                        draw_bbox=True
                    )

                    recordings_made += 1

                    # Get session info if available
                    session = strategy.get_active_session(track_id)
                    session_info = ""
                    if session:
                        duration = session.duration_seconds(datetime.utcnow())  # ✅ FIX: Pass current time
                        session_info = f" (Session: {duration:.0f}s, Record #{session.record_count})"

                    print(f"\n🎬 RECORDING #{recordings_made}")
                    print(f"   Track ID: {track_id}")
                    print(f"   Reason: {reason}{session_info}")
                    print(f"   Severity: {severity}")
                    print(f"   Missing PPE: {missing_ppe}")
                    print(f"   Snapshot: {snapshot_path}")
                else:
                    # DEBUG: Show why we're NOT recording
                    if track_id and not is_compliant:
                        session = strategy.get_active_session(track_id)
                        if session:
                            time_since = session.time_since_last_record(datetime.utcnow())
                            interval_needed = (
                                strategy.interval_critical if severity == "critical"
                                else strategy.interval_without_face if not has_face
                                else strategy.interval_with_face
                            )
                            if frame_count % 30 == 0:  # Print every 30 frames to avoid spam
                                print(f"⏳ Track {track_id}: Waiting... ({time_since:.1f}s / {interval_needed}s needed)")

                # Draw on frame
                bbox = person["bbox"]
                x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

                # Color based on compliance
                color = (0, 255, 0) if is_compliant else (0, 0, 255)

                # Draw rectangle
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

                # Draw label
                session = strategy.get_active_session(track_id)
                label = f"Person #{track_id}"
                if session:
                    duration = session.duration_seconds(datetime.utcnow())  # ✅ FIX: Pass current time
                    time_since = session.time_since_last_record(datetime.utcnow())
                    label += f" ({duration:.0f}s, next: {time_since:.0f}s)"
                if not is_compliant:
                    label += f" - {', '.join(missing_ppe)}"

                cv2.putText(
                    frame, label, (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2
                )

            # Cleanup stale sessions every 10 seconds
            if time.time() - last_cleanup > 10:
                cleaned = strategy.cleanup_stale_sessions()
                if cleaned > 0:
                    print(f"\n🧹 Cleaned up {cleaned} stale sessions")
                last_cleanup = time.time()

            # Show stats on frame
            stats_text = [
                f"Frame: {frame_count}",
                f"Persons: {len(detections)}",
                f"Recordings: {recordings_made}",
                f"Active Sessions: {len(strategy.active_sessions)}"
            ]

            for i, text in enumerate(stats_text):
                cv2.putText(
                    frame, text, (10, 30 + i * 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2
                )

            # Display
            cv2.imshow("Smart Recording Test", frame)

            # Handle key press
            key = cv2.waitKey(1) & 0xFF

            if key == ord('q'):
                print("\n\n👋 Stopping...")
                break
            elif key == ord('s'):
                print("\n" + "=" * 80)
                print("📊 STATISTICS")
                print("=" * 80)
                stats = strategy.get_stats()
                print(f"\nTotal detections: {stats['total_detections']}")
                print(f"Total recordings: {stats['total_recordings']}")
                print(f"Recording rate: {stats['recording_rate_percent']}%")
                print(f"Active sessions: {stats['active_sessions']}")
                print(f"\nRecordings by reason:")
                for reason, count in stats['recordings_by_reason'].items():
                    print(f"  {reason}: {count}")

    finally:
        cap.release()
        cv2.destroyAllWindows()

        # Final statistics
        print("\n" + "=" * 80)
        print("📊 FINAL STATISTICS")
        print("=" * 80)

        stats = strategy.get_stats()
        print(f"\n✅ Test completed")
        print(f"   Frames processed: {frame_count}")
        print(f"   Total detections: {stats['total_detections']}")
        print(f"   Recordings made: {stats['total_recordings']}")
        print(f"   Recording rate: {stats['recording_rate_percent']}%")

        print(f"\nRecording efficiency:")
        print(f"   Before (naive): 1 record per frame = {stats['total_detections']} records")
        print(f"   After (smart): {stats['total_recordings']} records")
        print(f"   Saved: {stats['total_detections'] - stats['total_recordings']} unnecessary records!")

        print(f"\nRecordings by reason:")
        for reason, count in sorted(stats['recordings_by_reason'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {reason}: {count}")

        snap_stats = snapshot_manager.get_stats()
        print(f"\nSnapshot storage:")
        print(f"   Total snapshots: {snap_stats['total_snapshots']}")
        print(f"   Storage used: {snap_stats['total_size_mb']} MB")

        print("\n" + "=" * 80)


if __name__ == "__main__":
    test_smart_recording()
