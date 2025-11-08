"""
PPE Compliance System - FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings, initialize_directories

# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Multi-domain İSG (İş Sağlığı ve Güvenliği) Uyumluluk ve İhlal Takip Sistemi",
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc",  # ReDoc
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
    print(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    initialize_directories()
    print("✅ Directories initialized")
    # TODO: Initialize database
    # TODO: Load ML models


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("👋 Shutting down gracefully")
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
# API ROUTES (To be implemented)
# ==========================================

# TODO: Include routers
# from backend.api import domains, cameras, violations
# app.include_router(domains.router, prefix=settings.api_v1_prefix, tags=["Domains"])
# app.include_router(cameras.router, prefix=settings.api_v1_prefix, tags=["Cameras"])
# app.include_router(violations.router, prefix=settings.api_v1_prefix, tags=["Violations"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )

