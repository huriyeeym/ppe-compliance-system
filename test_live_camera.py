"""
Test script for Live Camera functionality
Tests backend API, domains, and cameras
"""

import requests
import json
import sys

def test_live_camera():
    print("=" * 60)
    print("LIVE CAMERA TEST")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    # Test 1: Backend health check
    print("\n[1/5] Testing backend connection...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("   [OK] Backend is running")
        else:
            print(f"   [ERROR] Backend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("   [ERROR] Backend is not running!")
        print("   Please start backend with:")
        print("   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload")
        return False
    except Exception as e:
        print(f"   [ERROR] Error: {str(e)}")
        return False
    
    # Test 2: Check domains
    print("\n[2/5] Checking domains...")
    try:
        response = requests.get(f"{base_url}/api/v1/domains", timeout=5)
        if response.status_code == 200:
            domains = response.json()
            active_domains = [d for d in domains if d.get('status') == 'active']
            print(f"   [OK] Found {len(domains)} total domains")
            print(f"   [OK] Found {len(active_domains)} active domains")
            
            if len(active_domains) == 0:
                print("   [WARNING] No active domains found!")
                print("   Please create a domain first.")
                return False
            
            # Show domains
            for domain in active_domains[:3]:  # Show first 3
                print(f"      - {domain.get('name')} (ID: {domain.get('id')}, Type: {domain.get('type')})")
            
            selected_domain = active_domains[0]
            domain_id = selected_domain.get('id')
            print(f"\n   Using domain: {selected_domain.get('name')} (ID: {domain_id})")
        else:
            print(f"   [ERROR] Failed to get domains: {response.status_code}")
            return False
    except Exception as e:
        print(f"   [ERROR] Error: {str(e)}")
        return False
    
    # Test 3: Check cameras
    print("\n[3/5] Checking cameras...")
    try:
        response = requests.get(f"{base_url}/api/v1/cameras", params={"domain_id": domain_id}, timeout=5)
        if response.status_code == 200:
            cameras = response.json()
            active_cameras = [c for c in cameras if c.get('is_active')]
            print(f"   [OK] Found {len(cameras)} cameras for domain {domain_id}")
            print(f"   [OK] Found {len(active_cameras)} active cameras")
            
            if len(cameras) == 0:
                print("   [WARNING] No cameras found!")
                print("   Attempting to add a default camera...")
                
                # Add camera
                camera_data = {
                    "name": "Test Webcam",
                    "domain_id": domain_id,
                    "source_type": "webcam",
                    "source_uri": "0",
                    "is_active": True,
                    "location": "Test Location"
                }
                
                create_response = requests.post(
                    f"{base_url}/api/v1/cameras",
                    json=camera_data,
                    timeout=5
                )
                
                if create_response.status_code == 201:
                    new_camera = create_response.json()
                    print(f"   [OK] Camera created successfully!")
                    print(f"      Name: {new_camera.get('name')}")
                    print(f"      ID: {new_camera.get('id')}")
                    cameras = [new_camera]
                else:
                    print(f"   [ERROR] Failed to create camera: {create_response.status_code}")
                    print(f"   Response: {create_response.text}")
                    print("\n   You can manually add a camera using:")
                    print(f"   python add_camera.py")
                    return False
            else:
                # Show cameras
                for camera in cameras[:3]:  # Show first 3
                    status = "[Active]" if camera.get('is_active') else "[Inactive]"
                    print(f"      - {camera.get('name')} (ID: {camera.get('id')}) {status}")
        else:
            print(f"   [ERROR] Failed to get cameras: {response.status_code}")
            return False
    except Exception as e:
        print(f"   [ERROR] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    # Test 4: Check detection endpoint
    print("\n[4/5] Testing detection endpoint...")
    try:
        # Just check if endpoint exists
        response = requests.get(f"{base_url}/api/v1/detection/health", timeout=5)
        if response.status_code == 200:
            print("   [OK] Detection endpoint is accessible")
            health = response.json()
            if health.get('model_loaded'):
                print("   [OK] Model is loaded")
            else:
                print("   [WARNING] Model is not loaded yet")
        else:
            print(f"   [WARNING] Detection health check returned: {response.status_code}")
    except Exception as e:
        print(f"   [WARNING] Detection endpoint check failed: {str(e)}")
        print("   (This is OK if model is still loading)")
    
    # Test 5: Frontend check
    print("\n[5/5] Checking frontend...")
    try:
        response = requests.get("http://localhost:5173", timeout=5)
        if response.status_code == 200:
            print("   [OK] Frontend is running")
        else:
            print(f"   [WARNING] Frontend returned status {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("   [WARNING] Frontend is not running")
        print("   Please start frontend with:")
        print("   cd frontend && npm run dev")
    except Exception as e:
        print(f"   ⚠️  Frontend check failed: {str(e)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print("[OK] Backend: Running")
    print(f"[OK] Domains: {len(active_domains)} active")
    print(f"[OK] Cameras: {len(cameras)} found")
    print("\n📝 Next steps:")
    print("   1. Open http://localhost:5173 in your browser")
    print("   2. Navigate to 'Live Camera' page")
    print("   3. Click 'Start' button to begin streaming")
    print("   4. Allow webcam access when prompted")
    print("\n" + "=" * 60)
    
    return True

if __name__ == "__main__":
    success = test_live_camera()
    sys.exit(0 if success else 1)

