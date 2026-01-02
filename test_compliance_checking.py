"""
Test Compliance Checking Feature
Tests if missing PPE detection and severity levels work correctly
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.ml_engine.detector import PPEDetector
from backend.utils.logger import logger


def test_compliance_checking():
    print("=" * 60)
    print("TESTING COMPLIANCE CHECKING")
    print("=" * 60)

    # Create detector with required PPE
    print("\n1. Creating detector with required PPE: ['helmet', 'vest']")
    detector = PPEDetector(required_ppe=["helmet", "vest"])

    # Simulate detections
    print("\n2. Testing compliance logic with mock data...")

    # Test Case 1: Person with all PPE
    print("\n   Test Case 1: Person WITH helmet and vest")
    mock_detections_compliant = [
        {
            "class": "person",
            "confidence": 0.95,
            "bbox": {"x": 100, "y": 100, "w": 50, "h": 100},
            "ppe_items": [
                {"type": "helmet", "confidence": 0.9},
                {"type": "vest", "confidence": 0.85}
            ]
        }
    ]
    result = detector._check_compliance(mock_detections_compliant)
    person = result[0]
    print(f"   ✅ Missing PPE: {person['missing_ppe']}")
    print(f"   ✅ Is Compliant: {person['is_compliant']}")
    print(f"   ✅ Compliance Score: {person['compliance_score']:.2f}")
    print(f"   ✅ Severity: {person['severity']}")

    # Test Case 2: Person missing vest
    print("\n   Test Case 2: Person WITH helmet, NO vest")
    mock_detections_partial = [
        {
            "class": "person",
            "confidence": 0.95,
            "bbox": {"x": 100, "y": 100, "w": 50, "h": 100},
            "ppe_items": [
                {"type": "helmet", "confidence": 0.9}
            ]
        }
    ]
    result = detector._check_compliance(mock_detections_partial)
    person = result[0]
    print(f"   ⚠️  Missing PPE: {person['missing_ppe']}")
    print(f"   ⚠️  Is Compliant: {person['is_compliant']}")
    print(f"   ⚠️  Compliance Score: {person['compliance_score']:.2f}")
    print(f"   ⚠️  Severity: {person['severity']}")

    # Test Case 3: Person with no PPE
    print("\n   Test Case 3: Person NO helmet, NO vest")
    mock_detections_none = [
        {
            "class": "person",
            "confidence": 0.95,
            "bbox": {"x": 100, "y": 100, "w": 50, "h": 100},
            "ppe_items": []
        }
    ]
    result = detector._check_compliance(mock_detections_none)
    person = result[0]
    print(f"   🔴 Missing PPE: {person['missing_ppe']}")
    print(f"   🔴 Is Compliant: {person['is_compliant']}")
    print(f"   🔴 Compliance Score: {person['compliance_score']:.2f}")
    print(f"   🔴 Severity: {person['severity']}")

    print("\n" + "=" * 60)
    print("COMPLIANCE CHECKING TEST COMPLETE!")
    print("=" * 60)
    print("\nExpected Results:")
    print("  Case 1: missing_ppe=[], is_compliant=True, score=1.0, severity=none")
    print("  Case 2: missing_ppe=['vest'], is_compliant=False, score=0.5, severity=warning")
    print("  Case 3: missing_ppe=['helmet','vest'], is_compliant=False, score=0.0, severity=critical")
    print("\nNext Step: Test with real webcam!")


if __name__ == "__main__":
    test_compliance_checking()
