"""
Add camera via API (safer method)
"""
import requests
import json

def add_camera():
    base_url = "http://localhost:8000"
    
    # Camera data
    camera_data = {
        "name": "Test Webcam",
        "domain_id": 1,  # Construction domain
        "source_type": "webcam",
        "source_uri": "0",  # Default webcam
        "is_active": True,
        "location": "Test Location"
    }
    
    print("Adding camera via API...")
    print(f"URL: {base_url}/api/v1/cameras")
    print(f"Data: {json.dumps(camera_data, indent=2)}")
    
    try:
        response = requests.post(
            f"{base_url}/api/v1/cameras",
            json=camera_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 201:
            camera = response.json()
            print("\n[OK] Camera created successfully!")
            print(f"   ID: {camera.get('id')}")
            print(f"   Name: {camera.get('name')}")
            print(f"   Domain ID: {camera.get('domain_id')}")
            print(f"   Source Type: {camera.get('source_type')}")
            print(f"   Active: {camera.get('is_active')}")
            return True
        else:
            print(f"\n[ERROR] Failed to create camera: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Backend is not running!")
        print("Please start backend first:")
        print("python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload")
        return False
    except Exception as e:
        print(f"\n[ERROR] Error: {str(e)}")
        return False

if __name__ == "__main__":
    add_camera()

