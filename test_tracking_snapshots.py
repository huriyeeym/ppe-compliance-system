"""
Test script for Person Tracking + Snapshot Storage
Demonstrates:
- ByteTrack person tracking across frames
- Violation deduplication (prevent duplicate records)
- Snapshot storage with bounding boxes
"""

import cv2
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.ml_engine.detector import PPEDetector
from backend.ml_engine.violation_manager import ViolationManager
from backend.utils.snapshots import SnapshotManager
from backend.utils.logger import logger


def test_tracking_and_snapshots():
    """Test person tracking and snapshot storage"""

    print("=" * 80)
    print("🎯 PPE Detection - Person Tracking + Snapshot Storage Test")
    print("=" * 80)

    # Initialize components
    print("\n1️⃣ Initializing detector with tracking enabled...")
    detector = PPEDetector(
        enable_tracking=True,  # Enable person tracking
        required_ppe=["helmet", "vest"]
    )

    print("\n2️⃣ Initializing violation manager (deduplication)...")
    violation_manager = ViolationManager(
        cooldown_seconds=5,  # Don't record same person twice within 5 seconds
        enable_deduplication=True
    )

    print("\n3️⃣ Initializing snapshot manager...")
    snapshot_manager = SnapshotManager()

    # Open webcam or video file
    print("\n4️⃣ Opening camera...")
    camera_id = 0  # Default webcam
    cap = cv2.VideoCapture(camera_id)

    if not cap.isOpened():
        print("❌ Failed to open camera")
        return

    print(f"✅ Camera opened: {camera_id}")

    frame_count = 0
    violations_recorded = 0

    print("\n5️⃣ Starting detection...")
    print("\nInstructions:")
    print("  - Stand in front of camera WITHOUT helmet/vest to trigger violations")
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
                missing_ppe = person.get("missing_ppe", [])

                # Check if we should record this violation
                if violation_manager.should_record_violation(track_id, is_compliant):
                    # Save snapshot
                    snapshot_path = snapshot_manager.save_snapshot(
                        frame=frame,
                        camera_id=camera_id,
                        person_bbox=person["bbox"],
                        track_id=track_id,
                        draw_bbox=True
                    )

                    violations_recorded += 1

                    print(f"\n🚨 VIOLATION RECORDED #{violations_recorded}")
                    print(f"   Track ID: {track_id}")
                    print(f"   Missing PPE: {missing_ppe}")
                    print(f"   Snapshot: {snapshot_path}")

                # Draw on frame
                bbox = person["bbox"]
                x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]

                # Color based on compliance
                color = (0, 255, 0) if is_compliant else (0, 0, 255)  # Green / Red

                # Draw rectangle
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)

                # Draw label
                label = f"Person #{track_id}" if track_id else "Person"
                if not is_compliant:
                    label += f" - Missing: {', '.join(missing_ppe)}"

                cv2.putText(
                    frame,
                    label,
                    (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    color,
                    2
                )

            # Show stats on frame
            stats_text = [
                f"Frame: {frame_count}",
                f"Persons: {len(detections)}",
                f"Violations Recorded: {violations_recorded}"
            ]

            for i, text in enumerate(stats_text):
                cv2.putText(
                    frame,
                    text,
                    (10, 30 + i * 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 255),
                    2
                )

            # Display
            cv2.imshow("PPE Detection - Tracking Test", frame)

            # Handle key press
            key = cv2.waitKey(1) & 0xFF

            if key == ord('q'):
                print("\n\n👋 Stopping...")
                break
            elif key == ord('s'):
                print("\n" + "=" * 80)
                print("📊 STATISTICS")
                print("=" * 80)
                print(f"\nFrames processed: {frame_count}")
                print(f"\nViolation Manager:")
                vm_stats = violation_manager.get_stats()
                for key, value in vm_stats.items():
                    print(f"  {key}: {value}")

                print(f"\nSnapshot Manager:")
                snap_stats = snapshot_manager.get_stats()
                for key, value in snap_stats.items():
                    print(f"  {key}: {value}")

    finally:
        cap.release()
        cv2.destroyAllWindows()

        # Final statistics
        print("\n" + "=" * 80)
        print("📊 FINAL STATISTICS")
        print("=" * 80)

        print(f"\n✅ Test completed")
        print(f"   Frames processed: {frame_count}")
        print(f"   Violations recorded: {violations_recorded}")

        vm_stats = violation_manager.get_stats()
        print(f"\nViolation Manager:")
        for key, value in vm_stats.items():
            print(f"   {key}: {value}")

        snap_stats = snapshot_manager.get_stats()
        print(f"\nSnapshot Manager:")
        for key, value in snap_stats.items():
            print(f"   {key}: {value}")

        print("\n" + "=" * 80)


if __name__ == "__main__":
    test_tracking_and_snapshots()
