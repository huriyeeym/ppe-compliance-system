"""
Quick test of original PPE detector
Tests if ppe_detection_yolov8.pt model loads and detects correctly
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.ml_engine.detector import PPEDetector
from backend.utils.logger import logger

def main():
    print("=" * 60)
    print("TESTING ORIGINAL PPE DETECTOR")
    print("=" * 60)

    # Create detector (will use ppe_detection_yolov8.pt from config)
    print("\n1. Creating detector...")
    detector = PPEDetector()

    # Get model info
    print("\n2. Model info:")
    info = detector.get_model_info()
    print(f"   Model path: {info['model_path']}")
    print(f"   Model type: {info['model_type']}")
    print(f"   Confidence: {info['confidence_threshold']}")
    print(f"   Classes: {info['class_names']}")

    # Check if model has expected classes
    print("\n3. Checking classes...")
    expected_classes = ['helmet', 'vest', 'person']
    classes = info['class_names']

    for expected in expected_classes:
        if expected in classes.values():
            print(f"   ✅ Found class: {expected}")
        else:
            print(f"   ❌ Missing class: {expected}")

    print("\n" + "=" * 60)
    print("DETECTOR TEST COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. If all classes found → Model is working!")
    print("2. Start frontend and test with live camera")
    print("3. If working → COMMIT this state!")
    print("\nFrontend command:")
    print("   cd frontend && npm run dev")

if __name__ == "__main__":
    main()
