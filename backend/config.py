"""
Configuration management for PPE Compliance System
Uses pydantic-settings for type-safe configuration from environment variables
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file
    
    Usage:
        from backend.config import settings
        print(settings.database_url)
    """
    
    # ==========================================
    # APPLICATION
    # ==========================================
    app_name: str = "PPE Compliance System"
    app_version: str = "0.1.0"
    debug: bool = True
    
    # ==========================================
    # DATABASE
    # ==========================================
    database_url: str = "sqlite+aiosqlite:///./data/ppe_compliance.db"
    # Production: postgresql+asyncpg://user:pass@localhost/ppe_db
    
    # ==========================================
    # ML MODEL
    # ==========================================
    model_base_path: Path = Path("data/models")
    default_model: str = "construction_manufacturing_v1.pt"
    confidence_threshold: float = 0.5  # Minimum detection confidence
    
    # ==========================================
    # VIDEO PROCESSING
    # ==========================================
    default_webcam_index: int = 0
    frame_skip: int = 2  # Process every Nth frame (1 = every frame)
    max_fps: int = 30
    
    # ==========================================
    # API
    # ==========================================
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = [
        "http://localhost:3000",  # Frontend dev server (Next.js)
        "http://localhost:5173",  # Frontend dev server (Vite default)
        "http://localhost:5174",  # Vite fallback port
        "http://localhost:5175",  # Extra dev slot
        "http://localhost:8000",  # Backend docs
    ]
    
    # ==========================================
    # SECURITY (Future)
    # ==========================================
    secret_key: str = "CHANGE_THIS_IN_PRODUCTION"  # For JWT
    access_token_expire_minutes: int = 30
    jwt_algorithm: str = "HS256"
    
    # ==========================================
    # PATHS
    # ==========================================
    data_dir: Path = Path("data")
    datasets_dir: Path = Path("data/datasets")
    models_dir: Path = Path("data/models")
    logs_dir: Path = Path("logs")
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        protected_namespaces=()  # Allow field names starting with 'model_'
    )


# Global settings instance
settings = Settings()


# Create directories if they don't exist
def initialize_directories():
    """Create necessary directories on startup"""
    directories = [
        settings.data_dir,
        settings.datasets_dir,
        settings.models_dir,
        settings.logs_dir,
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

