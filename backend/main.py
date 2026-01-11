"""
PPE Compliance System - FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings, initialize_directories
from backend.utils.logger import logger

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Multi-domain İSG (İş Sağlığı ve Güvenliği) Uyumluluk ve İhlal Takip Sistemi",
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc
    redirect_slashes=False,  # Disable automatic trailing slash redirects
)

# CORS middleware (allow frontend to access API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# STARTUP & SHUTDOWN EVENTS
# ==========================================

@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    initialize_directories()
    logger.info("Directories initialized")
    
    # Initialize database
    from backend.database.connection import init_db
    await init_db()
    logger.info("Database initialized")
    
    # Load email configuration from database
    try:
        from backend.database.connection import AsyncSessionLocal
        from backend.database.models import NotificationSettings
        from backend.services.email_service import EmailConfig, configure_email_service
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(NotificationSettings))
            email_settings = result.scalars().first()
            
            if email_settings and email_settings.smtp_user and email_settings.smtp_password:
                # Strip whitespace and check if not empty
                smtp_user = email_settings.smtp_user.strip() if email_settings.smtp_user else ""
                smtp_password = email_settings.smtp_password.strip() if email_settings.smtp_password else ""
                
                if smtp_user and smtp_password:
                    email_config = EmailConfig(
                        smtp_host=email_settings.smtp_host or "smtp.gmail.com",
                        smtp_port=email_settings.smtp_port or 587,
                        smtp_user=smtp_user,
                        smtp_password=smtp_password,
                        from_email=email_settings.from_email or smtp_user,
                        from_name=email_settings.from_name or "PPE Safety System",
                        use_tls=email_settings.use_tls if email_settings.use_tls is not None else True,
                    )
                    configure_email_service(email_config)
                    logger.info("Email service configured from database settings")
                else:
                    logger.info("Email service not configured - SMTP credentials are empty")
            else:
                logger.info("Email service not configured - no SMTP credentials in database")
    except Exception as e:
        logger.warning(f"Failed to load email configuration on startup: {str(e)}")

    # Ensure default email templates exist
    try:
        from backend.services.email_template_service import EmailTemplateService

        async with AsyncSessionLocal() as db:
            await EmailTemplateService.ensure_default_templates(db)
            logger.info("Default email templates ensured")
    except Exception as e:
        logger.warning(f"Failed to ensure email templates: {str(e)}")

    # Start notification scheduler
    try:
        from backend.services.scheduler_service import start_scheduler
        start_scheduler()
        logger.info("Notification scheduler started")
    except Exception as e:
        logger.error(f"Failed to start notification scheduler: {str(e)}", exc_info=True)

    # TODO: Load ML models


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down gracefully")

    # Stop notification scheduler
    try:
        from backend.services.scheduler_service import stop_scheduler
        stop_scheduler()
        logger.info("Notification scheduler stopped")
    except Exception as e:
        logger.error(f"Failed to stop notification scheduler: {str(e)}")

    # TODO: Close database connections
    # TODO: Cleanup resources


# ==========================================
# HEALTH CHECK ENDPOINT
# ==========================================

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Health check endpoint
    Returns basic system status
    """
    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "debug": settings.debug,
    }


@app.get("/", tags=["Root"])
async def root():
    """
    Root endpoint - API information
    """
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }


# ==========================================
# API ROUTES
# ==========================================

from backend.api import domains, cameras, violations, ppe_types, detection, auth, users, notification_settings, notification_schedules, maintenance, websocket, organizations, files

app.include_router(domains.router, prefix=settings.api_v1_prefix)
app.include_router(ppe_types.router, prefix=settings.api_v1_prefix)
app.include_router(cameras.router, prefix=settings.api_v1_prefix)
app.include_router(violations.router, prefix=settings.api_v1_prefix)
app.include_router(detection.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(organizations.router, prefix=settings.api_v1_prefix)
app.include_router(notification_settings.router, prefix=settings.api_v1_prefix)
app.include_router(notification_schedules.router, prefix=settings.api_v1_prefix)
app.include_router(maintenance.router, prefix=settings.api_v1_prefix)
app.include_router(websocket.router, prefix=settings.api_v1_prefix)  # ✅ WebSocket endpoint
app.include_router(files.router, prefix=settings.api_v1_prefix)  # ✅ File serving endpoint


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )

