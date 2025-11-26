"""
SQLAlchemy ORM Models for PPE Compliance System
Multi-domain architecture with flexible PPE rules
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, Text,
    ForeignKey, Enum as SQLEnum, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from enum import Enum


Base = declarative_base()


# ==========================================
# ENUMS
# ==========================================

class DomainStatus(str, Enum):
    """Domain activation status"""
    ACTIVE = "active"      # Model trained, ready to use
    PLANNED = "planned"    # Documented but not yet implemented


class SourceType(str, Enum):
    """Camera source types"""
    WEBCAM = "webcam"
    RTSP = "rtsp"
    FILE = "file"


class ViolationSeverity(str, Enum):
    """Violation severity levels"""
    CRITICAL = "critical"  # Required PPE missing
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class UserRole(str, Enum):
    """Application user roles"""
    SUPER_ADMIN = "super_admin"  # Full system access
    DOMAIN_ADMIN = "domain_admin"  # Domain-specific management
    VIEWER = "viewer"  # Read-only access


# ==========================================
# MODELS
# ==========================================

class Domain(Base):
    """
    Work domain/area (e.g., construction, manufacturing, mining)
    Each domain has specific PPE requirements
    """
    __tablename__ = "domains"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)  # "İnşaat Alanı"
    type = Column(String(50), unique=True, nullable=False)   # "construction"
    icon = Column(String(10), nullable=True)                 # "🏗️"
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(DomainStatus), default=DomainStatus.PLANNED)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    cameras = relationship("Camera", back_populates="domain")
    violations = relationship("Violation", back_populates="domain")
    ppe_rules = relationship("DomainPPERule", back_populates="domain")
    
    def __repr__(self):
        return f"<Domain(id={self.id}, name='{self.name}', status='{self.status}')>"


class PPEType(Base):
    """
    PPE item type (e.g., hard_hat, safety_vest, gloves)
    Reusable across domains
    """
    __tablename__ = "ppe_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)   # "hard_hat"
    display_name = Column(String(100), nullable=False)       # "Baret"
    category = Column(String(20), nullable=False)            # "head", "eye", "hand"
    model_class_name = Column(String(50), nullable=True)     # YOLO class name
    status = Column(SQLEnum(DomainStatus), default=DomainStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    domain_rules = relationship("DomainPPERule", back_populates="ppe_type")
    
    def __repr__(self):
        return f"<PPEType(id={self.id}, name='{self.name}')>"


class DomainPPERule(Base):
    """
    Defines which PPE is required/recommended for each domain
    Junction table with additional attributes
    """
    __tablename__ = "domain_ppe_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    ppe_type_id = Column(Integer, ForeignKey("ppe_types.id"), nullable=False)
    is_required = Column(Boolean, default=True)              # Zorunlu mu?
    priority = Column(Integer, default=1)                    # 1=critical, 2=high, 3=medium
    warning_message = Column(String(200), nullable=True)     # Custom message
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    domain = relationship("Domain", back_populates="ppe_rules")
    ppe_type = relationship("PPEType", back_populates="domain_rules")
    
    def __repr__(self):
        return f"<DomainPPERule(domain_id={self.domain_id}, ppe_type_id={self.ppe_type_id}, required={self.is_required})>"


class Camera(Base):
    """
    Camera source (webcam, RTSP, file)
    Assigned to a specific domain
    """
    __tablename__ = "cameras"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)               # "Lobby Camera"
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    source_type = Column(SQLEnum(SourceType), nullable=False)
    source_uri = Column(String(500), nullable=False)         # "/dev/video0", "rtsp://..."
    is_active = Column(Boolean, default=True)
    location = Column(String(200), nullable=True)            # "Building A, Floor 2"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    domain = relationship("Domain", back_populates="cameras")
    violations = relationship("Violation", back_populates="camera")
    
    def __repr__(self):
        return f"<Camera(id={self.id}, name='{self.name}', type='{self.source_type}')>"


class Violation(Base):
    """
    PPE violation record
    Stores detected violations with timestamp and snapshot
    """
    __tablename__ = "violations"
    
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)  # Denormalized for fast filtering
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Detection data (JSON)
    person_bbox = Column(JSON, nullable=False)               # {"x": 100, "y": 200, "w": 50, "h": 100}
    detected_ppe = Column(JSON, nullable=False)              # [{"type": "hard_hat", "confidence": 0.95}]
    missing_ppe = Column(JSON, nullable=False)               # [{"type": "safety_vest", "required": true}]
    track_id = Column(Integer, nullable=True)                # Model-based identifier per person
    
    confidence = Column(Float, nullable=False)               # Average detection confidence
    severity = Column(SQLEnum(ViolationSeverity), default=ViolationSeverity.MEDIUM)
    frame_snapshot = Column(Text, nullable=True)             # Legacy base64 snapshot (deprecated)
    snapshot_path = Column(String(300), nullable=True)       # Relative file path under data/snapshots
    
    # Acknowledgment
    acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_by = Column(String(100), nullable=True)     # Username (future)
    acknowledged_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)                      # User notes
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    camera = relationship("Camera", back_populates="violations")
    domain = relationship("Domain", back_populates="violations")
    
    def __repr__(self):
        return f"<Violation(id={self.id}, camera_id={self.camera_id}, timestamp='{self.timestamp}')>"


class DetectionLog(Base):
    """
    Aggregated detection statistics (for dashboard)
    Stores periodic summaries
    """
    __tablename__ = "detection_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(Integer, ForeignKey("cameras.id"), nullable=False)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    person_count = Column(Integer, default=0)                # Total people detected
    compliant_count = Column(Integer, default=0)             # People with all required PPE
    violation_count = Column(Integer, default=0)             # People with missing PPE
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<DetectionLog(camera_id={self.camera_id}, timestamp='{self.timestamp}')>"


class User(Base):
    """
    Application user for authentication/authorization
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"

