"""
Email Service Debug Script
Tests email configuration and sends a test email.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from backend.database.connection import AsyncSessionLocal
from backend.database.models import NotificationSettings
from backend.services.email_service import EmailConfig, configure_email_service, get_email_service
from sqlalchemy import select


async def debug_email_service():
    """Debug email service configuration"""
    print("=" * 60)
    print("EMAIL SERVICE DEBUG")
    print("=" * 60)
    
    # Check database settings
    print("\n1. Checking database settings...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(NotificationSettings))
        settings = result.scalars().first()
        
        if not settings:
            print("   ❌ No notification settings found in database")
            return
        
        print(f"   ✅ Settings found")
        print(f"   - smtp_user: {settings.smtp_user if settings.smtp_user else 'None'} (len={len(settings.smtp_user) if settings.smtp_user else 0})")
        print(f"   - smtp_password: {'SET' if settings.smtp_password else 'NOT SET'} (len={len(settings.smtp_password) if settings.smtp_password else 0})")
        print(f"   - smtp_host: {settings.smtp_host}")
        print(f"   - smtp_port: {settings.smtp_port}")
        print(f"   - use_tls: {settings.use_tls}")
        print(f"   - enabled: {settings.enabled}")
        
        # Validate credentials
        smtp_user = (settings.smtp_user or "").strip()
        smtp_password = (settings.smtp_password or "").strip()
        
        print(f"\n2. Validating credentials...")
        print(f"   - smtp_user (stripped): '{smtp_user}' (len={len(smtp_user)})")
        print(f"   - smtp_password (stripped): {'SET' if smtp_password else 'NOT SET'} (len={len(smtp_password)})")
        
        if not smtp_user or not smtp_password:
            print("   ❌ Credentials are empty or invalid")
            return
        
        print("   ✅ Credentials are valid")
        
        # Configure email service
        print(f"\n3. Configuring email service...")
        email_config = EmailConfig(
            smtp_host=settings.smtp_host or "smtp.gmail.com",
            smtp_port=settings.smtp_port or 587,
            smtp_user=smtp_user,
            smtp_password=smtp_password,
            from_email=settings.from_email or smtp_user,
            from_name=settings.from_name or "PPE Safety System",
            use_tls=settings.use_tls if settings.use_tls is not None else True,
        )
        configure_email_service(email_config)
        
        # Check email service status
        print(f"\n4. Checking email service status...")
        email_service = get_email_service()
        print(f"   - enabled: {email_service.enabled}")
        print(f"   - smtp_user: '{email_service.config.smtp_user}' (len={len(email_service.config.smtp_user) if email_service.config.smtp_user else 0})")
        print(f"   - smtp_password: {'SET' if email_service.config.smtp_password else 'NOT SET'} (len={len(email_service.config.smtp_password) if email_service.config.smtp_password else 0})")
        print(f"   - smtp_host: {email_service.config.smtp_host}")
        print(f"   - smtp_port: {email_service.config.smtp_port}")
        print(f"   - use_tls: {email_service.config.use_tls}")
        
        if not email_service.enabled:
            print("\n   ❌ Email service is NOT enabled!")
            print("   Reason: Credentials are empty or invalid")
            return
        
        print("   ✅ Email service is enabled")
        
        # Test email sending
        print(f"\n5. Testing email sending...")
        test_email = input("   Enter test email address (or press Enter to skip): ").strip()
        
        if not test_email:
            print("   ⏭️  Skipping email test")
            return
        
        try:
            success = email_service.send_email(
                to_emails=[test_email],
                subject="🧪 Test Email - PPE Safety System",
                html_body="""
                <!DOCTYPE html>
                <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #405189;">✅ Email Configuration Test</h2>
                    <p>This is a test email from your PPE Safety Monitoring System.</p>
                    <p>If you're seeing this message, your email configuration is working correctly!</p>
                </body>
                </html>
                """,
                text_body="✅ EMAIL CONFIGURATION TEST\n\nThis is a test email from your PPE Safety Monitoring System.",
            )
            
            if success:
                print(f"   ✅ Test email sent successfully to {test_email}")
            else:
                print(f"   ❌ Failed to send test email")
        except Exception as e:
            print(f"   ❌ Error sending test email: {str(e)}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(debug_email_service())

