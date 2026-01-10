"""
Notification Settings API Endpoints

Manages email and alert configuration.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from backend.database.connection import get_db
from backend.database.models import NotificationSettings
from backend.services.email_service import EmailConfig, configure_email_service, get_email_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notification-settings", tags=["notification-settings"])


# Pydantic Models
class NotificationSettingsCreate(BaseModel):
    """Create/Update notification settings"""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: str = "PPE Safety System"
    use_tls: bool = True

    alert_recipients: List[EmailStr] = []
    summary_recipients: List[EmailStr] = []

    critical_violation_threshold: int = 1
    high_violation_threshold: int = 3
    bulk_violation_threshold: int = 10

    send_immediate_alerts: bool = True
    send_daily_summary: bool = True
    send_weekly_summary: bool = False
    daily_summary_time: str = "08:00"

    enabled: bool = False


class NotificationSettingsResponse(BaseModel):
    """Notification settings response"""

    id: int
    smtp_host: str
    smtp_port: int
    smtp_user: Optional[str]
    from_email: Optional[str]
    from_name: str
    use_tls: bool

    alert_recipients: List[str]
    summary_recipients: List[str]

    critical_violation_threshold: int
    high_violation_threshold: int
    bulk_violation_threshold: int

    send_immediate_alerts: bool
    send_daily_summary: bool
    send_weekly_summary: bool
    daily_summary_time: str

    enabled: bool

    class Config:
        from_attributes = True


class TestEmailRequest(BaseModel):
    """Test email request"""

    to_email: EmailStr


@router.get("", response_model=NotificationSettingsResponse)
async def get_notification_settings(db: AsyncSession = Depends(get_db)):
    """
    Get current notification settings.
    Creates default settings if none exist.
    """
    result = await db.execute(select(NotificationSettings))
    settings = result.scalars().first()

    if not settings:
        # Create default settings
        settings = NotificationSettings()
        db.add(settings)
        await db.commit()
        await db.refresh(settings)

    return settings


@router.put("", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    settings_update: NotificationSettingsCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update notification settings.
    Reconfigures the email service with new settings.
    """
    result = await db.execute(select(NotificationSettings))
    settings = result.scalars().first()

    if not settings:
        settings = NotificationSettings()
        db.add(settings)

    # Update fields
    for key, value in settings_update.dict().items():
        setattr(settings, key, value)

    await db.commit()
    await db.refresh(settings)

    # Reconfigure email service
    try:
        # Only configure if SMTP credentials are provided (strip whitespace and check)
        if settings.smtp_user and settings.smtp_password:
            smtp_user = settings.smtp_user.strip()
            smtp_password = settings.smtp_password.strip()
            
            logger.info(f"Updating email settings: smtp_user='{smtp_user}' (len={len(smtp_user)}), smtp_password={'SET' if smtp_password else 'EMPTY'} (len={len(smtp_password)})")
            
            if smtp_user and smtp_password:
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
                logger.info(f"Email service reconfigured successfully: enabled={get_email_service().enabled}")
            else:
                logger.warning(f"SMTP credentials not provided or empty - email service not configured. smtp_user='{smtp_user}', smtp_password={'SET' if smtp_password else 'EMPTY'}")
    except Exception as e:
        logger.error(f"Failed to reconfigure email service: {str(e)}", exc_info=True)

    return settings


@router.post("/test-email")
async def send_test_email(
    test_request: TestEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send a test email to verify configuration.
    """
    result = await db.execute(select(NotificationSettings))
    settings = result.scalars().first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification settings not found. Please configure SMTP settings first."
        )

    # Validate SMTP credentials
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP credentials not configured. Please configure SMTP settings first."
        )
    
    # Strip whitespace and validate
    smtp_user = settings.smtp_user.strip() if settings.smtp_user else ""
    smtp_password = settings.smtp_password.strip() if settings.smtp_password else ""
    
    if not smtp_user or not smtp_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SMTP credentials are empty after trimming. smtp_user length: {len(smtp_user)}, smtp_password length: {len(smtp_password)}"
        )

    # Temporarily configure email service with current settings for testing
    logger.info(f"Configuring email service for test: smtp_host={settings.smtp_host}, smtp_port={settings.smtp_port}, smtp_user={smtp_user}, use_tls={settings.use_tls}")
    
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

    email_service = get_email_service()
    logger.info(f"Email service status after configuration: enabled={email_service.enabled}, smtp_user='{email_service.config.smtp_user}' (len={len(email_service.config.smtp_user) if email_service.config.smtp_user else 0}), smtp_password={'SET' if email_service.config.smtp_password else 'NOT SET'} (len={len(email_service.config.smtp_password) if email_service.config.smtp_password else 0})")
    
    # Double-check: if still not enabled, there's a problem
    if not email_service.enabled:
        error_msg = (
            f"Email service configuration failed. "
            f"Configured smtp_user='{smtp_user}' (len={len(smtp_user)}), "
            f"but email service has smtp_user='{email_service.config.smtp_user}' (len={len(email_service.config.smtp_user) if email_service.config.smtp_user else 0}). "
            f"This indicates a configuration issue."
        )
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service configuration failed. Please check backend logs for details."
        )

    subject = "🧪 Test Email - PPE Safety System"
    html_body = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #405189;">✅ Email Configuration Test</h2>
        <p>This is a test email from your PPE Safety Monitoring System.</p>
        <p>If you're seeing this message, your email configuration is working correctly!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">
            PPE Safety System - Automated Test Email
        </p>
    </body>
    </html>
    """
    text_body = """
    ✅ EMAIL CONFIGURATION TEST

    This is a test email from your PPE Safety Monitoring System.
    If you're seeing this message, your email configuration is working correctly!

    ---
    PPE Safety System - Automated Test Email
    """

    try:
        # Check if email service is enabled before attempting to send
        if not email_service.enabled:
            logger.error(f"Email service is not enabled. smtp_user='{email_service.config.smtp_user}', smtp_password={'SET' if email_service.config.smtp_password else 'NOT SET'}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email service is not configured. Please check your SMTP settings and ensure credentials are valid."
            )
        
        logger.info(f"Attempting to send test email to {test_request.to_email}")
        success = email_service.send_email(
            to_emails=[test_request.to_email],
            subject=subject,
            html_body=html_body,
            text_body=text_body,
        )

        if success:
            logger.info(f"Test email sent successfully to {test_request.to_email}")
            return {"status": "success", "message": f"Test email sent to {test_request.to_email}"}
        else:
            logger.error("Email service returned False - email not sent")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send test email. Email service returned False. Check email configuration and logs."
            )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        error_type = type(e).__name__
        error_message = str(e) if str(e) else f"{error_type} occurred"
        error_details = f"{error_type}: {error_message}"
        
        # Log full exception with traceback
        logger.error(f"Test email failed: {error_details}", exc_info=True)
        
        # Provide more helpful error message
        if "SMTP Authentication" in error_message or "535" in error_message:
            detail_msg = "SMTP authentication failed. Please check your email and App Password."
        elif "Email service not configured" in error_message or not email_service.enabled:
            detail_msg = "Email service is not configured. Please check your SMTP settings."
        elif "connection" in error_message.lower() or "timeout" in error_message.lower():
            detail_msg = f"SMTP connection error: {error_message}"
        else:
            detail_msg = f"Failed to send test email: {error_message}"
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg
        )


@router.post("/enable")
async def enable_notifications(db: AsyncSession = Depends(get_db)):
    """Enable email notifications"""
    result = await db.execute(select(NotificationSettings))
    settings = result.scalars().first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification settings not found. Please configure first."
        )

    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMTP credentials not configured"
        )

    settings.enabled = True
    await db.commit()

    return {"status": "success", "message": "Email notifications enabled"}


@router.post("/disable")
async def disable_notifications(db: AsyncSession = Depends(get_db)):
    """Disable email notifications"""
    result = await db.execute(select(NotificationSettings))
    settings = result.scalars().first()

    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification settings not found"
        )

    settings.enabled = False
    await db.commit()

    return {"status": "success", "message": "Email notifications disabled"}


@router.get("/debug")
async def debug_email_service(db: AsyncSession = Depends(get_db)):
    """
    Debug endpoint to check email service status.
    Returns detailed information about email configuration.
    """
    result = await db.execute(select(NotificationSettings))
    settings = result.scalars().first()
    
    email_service = get_email_service()
    
    debug_info = {
        "database_settings": {
            "exists": settings is not None,
            "smtp_user": settings.smtp_user if settings else None,
            "smtp_user_length": len(settings.smtp_user) if settings and settings.smtp_user else 0,
            "smtp_password_set": bool(settings.smtp_password) if settings else False,
            "smtp_password_length": len(settings.smtp_password) if settings and settings.smtp_password else 0,
            "smtp_host": settings.smtp_host if settings else None,
            "smtp_port": settings.smtp_port if settings else None,
            "use_tls": settings.use_tls if settings else None,
            "enabled": settings.enabled if settings else None,
        },
        "email_service": {
            "enabled": email_service.enabled,
            "smtp_user": email_service.config.smtp_user,
            "smtp_user_length": len(email_service.config.smtp_user) if email_service.config.smtp_user else 0,
            "smtp_password_set": bool(email_service.config.smtp_password),
            "smtp_password_length": len(email_service.config.smtp_password) if email_service.config.smtp_password else 0,
            "smtp_host": email_service.config.smtp_host,
            "smtp_port": email_service.config.smtp_port,
            "use_tls": email_service.config.use_tls,
            "from_email": email_service.config.from_email,
        },
        "validation": {
            "database_has_credentials": bool(
                settings and 
                settings.smtp_user and 
                settings.smtp_password and
                settings.smtp_user.strip() and
                settings.smtp_password.strip()
            ) if settings else False,
            "email_service_has_credentials": bool(
                email_service.config.smtp_user and
                email_service.config.smtp_password and
                email_service.config.smtp_user.strip() and
                email_service.config.smtp_password.strip()
            ),
            "credentials_match": (
                settings and
                email_service.config.smtp_user == settings.smtp_user.strip() if settings and settings.smtp_user else False
            ),
        }
    }
    
    return debug_info
