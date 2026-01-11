"""
Quick diagnostic script to test the detection endpoint
Tests if the backend detection service is working correctly
"""

import requests
import cv2
import numpy as np
from pathlib import Path

def test_detection_endpoint():
    """Test the /detection/detect-frame endpoint"""

    print("=" * 60)
    print("PPE Detection Endpoint Diagnostic")
    print("=" * 60)
    print()

    # Test 1: Check if backend is running
    print("[1/4] Checking if backend is running...")
    try:
        response = requests.get("http://localhost:8000/detection/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"[OK] Backend is running")
            print(f"  Status: {data.get('status')}")
            print(f"  Model loaded: {data.get('model_loaded')}")
            print(f"  Model path: {data.get('model_path')}")
        else:
            print(f"[ERROR] Backend returned error: {response.status_code}")
            print("  Please start the backend with: python -m uvicorn backend.main:app --reload")
            return
    except requests.exceptions.ConnectionError:
        print("[ERROR] Backend is not running!")
        print("  Please start the backend with: python -m uvicorn backend.main:app --reload")
        return
    except Exception as e:
        print(f"[ERROR] Error connecting to backend: {e}")
        return

    print()

    # Test 2: Check model info
    print("[2/4] Checking model information...")
    try:
        response = requests.get("http://localhost:8000/detection/model-info")
        if response.status_code == 200:
            data = response.json()
            model_info = data.get('model_info', {})
            print(f"[OK] Model info retrieved")
            print(f"  Model path: {model_info.get('model_path')}")
            print(f"  Confidence threshold: {model_info.get('confidence_threshold')}")
            print(f"  Classes: {len(model_info.get('class_names', {}))} classes")
        else:
            print(f"[ERROR] Failed to get model info: {response.status_code}")
    except Exception as e:
        print(f"[ERROR] Error getting model info: {e}")

    print()

    # Test 3: Create a test image
    print("[3/4] Creating test image...")
    # Create a simple 640x480 test image with random content
    test_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)

    # Save temporarily
    test_path = Path("test_frame.jpg")
    cv2.imwrite(str(test_path), test_image)
    print(f"[OK] Test image created: {test_path}")
    print()

    # Test 4: Send frame to detection endpoint
    print("[4/4] Testing detection endpoint...")
    try:
        with open(test_path, 'rb') as f:
            files = {'file': ('frame.jpg', f, 'image/jpeg')}
            params = {'confidence': 0.5, 'camera_id': 0}

            response = requests.post(
                "http://localhost:8000/detection/detect-frame",
                files=files,
                params=params,
                timeout=10
            )

        if response.status_code == 200:
            data = response.json()
            print(f"[OK] Detection endpoint is working!")
            print(f"  Detections: {len(data.get('detections', []))}")
            print(f"  Smart recording enabled: {data.get('smart_recording_enabled')}")
            print(f"  Frame shape: {data.get('frame_shape')}")

            if 'violations_recorded' in data:
                print(f"  Violations recorded: {len(data.get('violations_recorded', []))}")

            if 'recording_stats' in data:
                stats = data['recording_stats']
                print(f"  Recording stats:")
                print(f"    Total recordings: {stats.get('total_recordings')}")
                print(f"    Active sessions: {stats.get('active_sessions')}")
        else:
            print(f"[ERROR] Detection endpoint returned error: {response.status_code}")
            print(f"  Response: {response.text}")

    except Exception as e:
        print(f"[ERROR] Error testing detection endpoint: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up test file
        if test_path.exists():
            test_path.unlink()
            print(f"\n[OK] Cleaned up test file")

    print()
    print("=" * 60)
    print("Diagnostic complete!")
    print("=" * 60)
    print()
    print("If all tests passed, the live camera should work.")
    print("If tests failed, check the error messages above.")
    print()

if __name__ == "__main__":
    test_detection_endpoint()
