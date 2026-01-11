"""
Quick test script to check backend and email service status
"""
import requests
import json

def test_backend():
    print("=" * 60)
    print("BACKEND & EMAIL SERVICE TEST")
    print("=" * 60)
    
    base_url = "http://localhost:8000"
    
    # Test 1: Health check
    print("\n1. Testing backend health...")
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("   ✅ Backend is running")
            print(f"   Response: {response.json()}")
        else:
            print(f"   ❌ Backend returned status {response.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("   ❌ Backend is not running or not accessible")
        print("   Please start backend with: python -m uvicorn backend.main:app --reload")
        return
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return
    
    # Test 2: Debug email service
    print("\n2. Checking email service status...")
    try:
        response = requests.get(f"{base_url}/api/v1/notification-settings/debug", timeout=5)
        if response.status_code == 200:
            debug_info = response.json()
            print("   ✅ Debug endpoint accessible")
            print("\n   Database Settings:")
            db_settings = debug_info.get("database_settings", {})
            print(f"      - Exists: {db_settings.get('exists')}")
            print(f"      - smtp_user: {db_settings.get('smtp_user')} (len={db_settings.get('smtp_user_length')})")
            print(f"      - smtp_password: {'SET' if db_settings.get('smtp_password_set') else 'NOT SET'} (len={db_settings.get('smtp_password_length')})")
            print(f"      - smtp_host: {db_settings.get('smtp_host')}")
            print(f"      - smtp_port: {db_settings.get('smtp_port')}")
            print(f"      - use_tls: {db_settings.get('use_tls')}")
            print(f"      - enabled: {db_settings.get('enabled')}")
            
            print("\n   Email Service:")
            email_service = debug_info.get("email_service", {})
            print(f"      - enabled: {email_service.get('enabled')}")
            print(f"      - smtp_user: {email_service.get('smtp_user')} (len={email_service.get('smtp_user_length')})")
            print(f"      - smtp_password: {'SET' if email_service.get('smtp_password_set') else 'NOT SET'} (len={email_service.get('smtp_password_length')})")
            print(f"      - smtp_host: {email_service.get('smtp_host')}")
            print(f"      - smtp_port: {email_service.get('smtp_port')}")
            print(f"      - use_tls: {email_service.get('use_tls')}")
            
            print("\n   Validation:")
            validation = debug_info.get("validation", {})
            print(f"      - Database has credentials: {validation.get('database_has_credentials')}")
            print(f"      - Email service has credentials: {validation.get('email_service_has_credentials')}")
            print(f"      - Credentials match: {validation.get('credentials_match')}")
            
            if not email_service.get('enabled'):
                print("\n   ⚠️  WARNING: Email service is NOT enabled!")
                if not validation.get('database_has_credentials'):
                    print("      Reason: Database credentials are missing or empty")
                elif not validation.get('email_service_has_credentials'):
                    print("      Reason: Email service credentials are missing or empty")
            else:
                print("\n   ✅ Email service is enabled and ready")
        else:
            print(f"   ❌ Debug endpoint returned status {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
    
    # Test 3: Get notification settings
    print("\n3. Getting notification settings...")
    try:
        response = requests.get(f"{base_url}/api/v1/notification-settings", timeout=5)
        if response.status_code == 200:
            settings = response.json()
            print("   ✅ Settings retrieved")
            print(f"      - smtp_host: {settings.get('smtp_host')}")
            print(f"      - smtp_port: {settings.get('smtp_port')}")
            print(f"      - smtp_user: {settings.get('smtp_user')} (len={len(settings.get('smtp_user') or '')})")
            print(f"      - smtp_password: {'SET' if settings.get('smtp_password') else 'NOT SET'} (len={len(settings.get('smtp_password') or '')})")
            print(f"      - use_tls: {settings.get('use_tls')}")
            print(f"      - enabled: {settings.get('enabled')}")
        else:
            print(f"   ❌ Failed to get settings: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)

if __name__ == "__main__":
    test_backend()

