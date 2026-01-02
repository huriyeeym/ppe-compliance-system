"""
Debug test for Smart Recording Strategy
Minimal test to verify interval logic works
"""

import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent))

from backend.ml_engine.violation_recording_strategy import SmartRecordingStrategy


def test_interval_logic():
    """Test that intervals actually work"""

    print("=" * 80)
    print("🔍 DEBUG TEST - Interval Logic")
    print("=" * 80)

    # Create strategy with SHORT intervals for testing
    strategy = SmartRecordingStrategy(
        interval_with_face_seconds=5,      # 5 seconds
        interval_without_face_seconds=3,   # 3 seconds
        interval_critical_seconds=2,       # 2 seconds
        enable_session_tracking=True
    )

    print("\nConfiguration:")
    print(f"  Interval with face: 5s")
    print(f"  Interval without face: 3s")
    print(f"  Interval critical: 2s")
    print("\n" + "=" * 80)

    # Simulate detections for same person
    track_id = 42

    # Time 0: First detection
    print("\n⏰ TIME: 0s")
    print("   Person #42 detected (no helmet, no vest)")

    should_record, reason = strategy.should_record(
        track_id=track_id,
        is_compliant=False,
        severity="critical",
        missing_ppe=["helmet", "vest"],
        has_face=False,
        timestamp=datetime(2025, 1, 1, 10, 0, 0)  # Fixed timestamp
    )

    print(f"   → Should record: {should_record}")
    print(f"   → Reason: {reason}")
    assert should_record == True, "❌ First detection should record!"
    assert reason == "first_detection", f"❌ Reason should be 'first_detection', got '{reason}'"
    print("   ✅ CORRECT: First detection recorded")

    # Time +1s: Same person, still violating
    print("\n⏰ TIME: +1s (1 second later)")
    print("   Person #42 still there (same violation)")

    should_record, reason = strategy.should_record(
        track_id=track_id,
        is_compliant=False,
        severity="critical",
        missing_ppe=["helmet", "vest"],
        has_face=False,
        timestamp=datetime(2025, 1, 1, 10, 0, 1)  # +1 second
    )

    print(f"   → Should record: {should_record}")
    print(f"   → Reason: {reason}")
    assert should_record == False, f"❌ Should NOT record (within 2s interval)! Got: {should_record}, reason: {reason}"
    print("   ✅ CORRECT: Skipped (within interval)")

    # Time +2s: Interval elapsed (critical = 2s)
    print("\n⏰ TIME: +2s (2 seconds later)")
    print("   Person #42 still there (interval elapsed)")

    should_record, reason = strategy.should_record(
        track_id=track_id,
        is_compliant=False,
        severity="critical",
        missing_ppe=["helmet", "vest"],
        has_face=False,
        timestamp=datetime(2025, 1, 1, 10, 0, 2)  # +2 seconds
    )

    print(f"   → Should record: {should_record}")
    print(f"   → Reason: {reason}")
    assert should_record == True, f"❌ Should record (2s interval elapsed)! Got: {should_record}"
    assert reason == "interval_elapsed", f"❌ Reason should be 'interval_elapsed', got '{reason}'"
    print("   ✅ CORRECT: Recorded (interval elapsed)")

    # Time +3s: Too soon again
    print("\n⏰ TIME: +3s (1 second after last record)")
    print("   Person #42 still there (too soon)")

    should_record, reason = strategy.should_record(
        track_id=track_id,
        is_compliant=False,
        severity="critical",
        missing_ppe=["helmet", "vest"],
        has_face=False,
        timestamp=datetime(2025, 1, 1, 10, 0, 3)  # +3 seconds
    )

    print(f"   → Should record: {should_record}")
    print(f"   → Reason: {reason}")
    assert should_record == False, f"❌ Should NOT record (only 1s since last)! Got: {should_record}"
    print("   ✅ CORRECT: Skipped (too soon)")

    # Time +10s: Person becomes compliant
    print("\n⏰ TIME: +10s (person puts on helmet)")
    print("   Person #42 now COMPLIANT")

    should_record, reason = strategy.should_record(
        track_id=track_id,
        is_compliant=True,  # NOW COMPLIANT
        severity="none",
        missing_ppe=[],
        has_face=False,
        timestamp=datetime(2025, 1, 1, 10, 0, 10)  # +10 seconds
    )

    print(f"   → Should record: {should_record}")
    print(f"   → Reason: {reason}")
    assert should_record == True, f"❌ Should record (status change)! Got: {should_record}"
    assert reason == "session_end", f"❌ Reason should be 'session_end', got '{reason}'"
    print("   ✅ CORRECT: Recorded (session ended)")

    # Final stats
    print("\n" + "=" * 80)
    print("📊 FINAL STATS")
    print("=" * 80)
    stats = strategy.get_stats()
    print(f"\nTotal detections: {stats['total_detections']}")
    print(f"Total recordings: {stats['total_recordings']}")
    print(f"Recording rate: {stats['recording_rate_percent']}%")
    print(f"\nExpected: 6 detections, 3 recordings (50%)")
    print(f"Actual: {stats['total_detections']} detections, {stats['total_recordings']} recordings ({stats['recording_rate_percent']}%)")

    assert stats['total_detections'] == 5, f"❌ Expected 5 detections, got {stats['total_detections']}"
    assert stats['total_recordings'] == 3, f"❌ Expected 3 recordings, got {stats['total_recordings']}"

    print("\n✅ ALL TESTS PASSED!")
    print("   Strategy logic is CORRECT!")
    print("   Interval system works as expected!")
    print("=" * 80)


if __name__ == "__main__":
    try:
        test_interval_logic()
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
