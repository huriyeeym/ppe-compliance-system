"""
Photo Upload API Test Script
Tests the user photo upload endpoint with face recognition
"""

import requests
import sys
from pathlib import Path

def test_photo_upload(test_image_path: Path = None):
    """Test photo upload API"""
    
    print("=" * 60)
    print("PHOTO UPLOAD API TEST")
    print("=" * 60)
    print()
    
    # Step 1: Login to get token
    print("[1/4] Logging in...")
    try:
        login_response = requests.post(
            "http://localhost:8000/api/v1/auth/login",
            data={
                "username": "user1@acme.com",  # Change to your admin email
                "password": "Test1234!Secure"  # Change to your password
            }
        )
        
        if login_response.status_code != 200:
            print(f"[ERROR] Login failed: {login_response.status_code}")
            print(f"  Response: {login_response.text}")
            return False
        
        token = login_response.json()["access_token"]
        print(f"[OK] Login successful")
        print(f"  Token: {token[:20]}...")
    except Exception as e:
        print(f"[ERROR] Login error: {e}")
        return False
    
    print()
    
    # Step 2: Get user ID (use first user from list)
    print("[2/4] Getting user list...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        users_response = requests.get(
            "http://localhost:8000/api/v1/users",
            headers=headers
        )
        
        if users_response.status_code != 200:
            print(f"[ERROR] Failed to get users: {users_response.status_code}")
            return False
        
        users = users_response.json()
        if not users:
            print("[ERROR] No users found. Please create a user first.")
            return False
        
        user_id = users[0]["id"]
        user_name = users[0]["full_name"]
        print(f"[OK] Found user: {user_name} (ID: {user_id})")
    except Exception as e:
        print(f"[ERROR] Error getting users: {e}")
        return False
    
    print()
    
    # Step 3: Find a test image
    print("[3/4] Looking for test image...")
    
    # If path provided as argument, use it
    if test_image_path and test_image_path.exists():
        print(f"[OK] Using provided test image: {test_image_path}")
    else:
        # Otherwise, try to find one automatically
        test_image_path = None
        
        # Try common locations
        possible_paths = [
            Path("test_photo.jpg"),
            Path("test_image.jpg"),
            Path("test.jpg"),
            Path("data/test_photo.jpg"),
        ]
        
        for path in possible_paths:
            if path.exists():
                test_image_path = path
                break
        
        # Or use any image from user's desktop/pictures
        if not test_image_path:
            desktop = Path.home() / "Desktop"
            if desktop.exists():
                for img_file in desktop.glob("*.jpg"):
                    test_image_path = img_file
                    break
                if not test_image_path:
                    for img_file in desktop.glob("*.png"):
                        test_image_path = img_file
                        break
        
        if not test_image_path or not test_image_path.exists():
            print("[WARNING] No test image found!")
            print("  Please provide a path to a test image:")
            print("  Usage: python scripts/test_photo_upload.py <path_to_image.jpg>")
            print()
            print("  Or place a test image named 'test_photo.jpg' in the project root")
            return False
        
        print(f"[OK] Using test image: {test_image_path}")
    print()
    
    # Step 4: Upload photo
    print(f"[4/4] Uploading photo for user {user_id}...")
    try:
        with open(test_image_path, 'rb') as f:
            files = {
                'file': (test_image_path.name, f, 'image/jpeg')
            }
            data = {
                'is_primary': 'true'
            }
            
            upload_response = requests.post(
                f"http://localhost:8000/api/v1/users/{user_id}/photos",
                headers=headers,
                files=files,
                data=data
            )
        
        if upload_response.status_code == 201:
            result = upload_response.json()
            print(f"[OK] Photo uploaded successfully!")
            print(f"  Photo ID: {result.get('id')}")
            print(f"  Photo Path: {result.get('photo_path')}")
            print(f"  Is Primary: {result.get('is_primary')}")
            print(f"  Face Encoding: {'Yes' if result.get('face_encoding') else 'No (no face detected)'}")
            print()
            print("✅ Test completed successfully!")
            return True
        else:
            print(f"[ERROR] Upload failed: {upload_response.status_code}")
            print(f"  Response: {upload_response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Upload error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Check if image path provided as argument
    test_image_path = None
    if len(sys.argv) > 1:
        test_image_path = Path(sys.argv[1])
        if not test_image_path.exists():
            print(f"[ERROR] Image not found: {test_image_path}")
            sys.exit(1)
    
    success = test_photo_upload(test_image_path)
    sys.exit(0 if success else 1)

