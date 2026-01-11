"""
SQLAlchemy ORM Models for PPE Compliance System
Multi-domain architecture with flexible PPE rules
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Float, DateTime, Text,
    ForeignKey, Enum as SQLEnum, JSON, Table
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


class ViolationStatus(str, Enum):
    """Violation workflow status"""
    OPEN = "open"                    # New violation, not yet reviewed
    IN_PROGRESS = "in_progress"      # Being investigated/resolved
    CLOSED = "closed"                # Resolved/acknowledged
    FALSE_POSITIVE = "false_positive"  # Incorrect detection


class UserRole(str, Enum):
    """Application user roles with hierarchical permissions"""
    SUPER_ADMIN = "super_admin"  # Full system access, all domains
    ADMIN = "admin"  # Full access to assigned domains
    MANAGER = "manager"  # Manage violations, view analytics, limited config
    OPERATOR = "operator"  # Acknowledge violations, view live camera
    VIEWER = "viewer"  # Read-only access


# ==========================================
# MODELS
# ==========================================

class Organization(Base):
    """
    Organization/Company model for multi-tenant support
    Each organization is isolated from others
    """
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)  # "Acme Corporation"
    slug = Column(String(200), nullable=False, unique=True, index=True)  # "acme-corporation" (URL-friendly)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="organization")
    cameras = relationship("Camera", back_populates="organization")
    violations = relationship("Violation", back_populates="organization")
    domains = relationship("Domain", secondary="organization_domains", back_populates="organizations")
    
    def __repr__(self):
        return f"<Organization(id={self.id}, name='{self.name}')>"


# Association table for User-Domain many-to-many relationship
user_domains = Table(
    'user_domains',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('domain_id', Integer, ForeignKey('domains.id'), primary_key=True),
    Column('created_at', DateTime, default=datetime.utcnow)
)

# Association table for Organization-Domain many-to-many relationship
organization_domains = Table(
    'organization_domains',
    Base.metadata,
    Column('organization_id', Integer, ForeignKey('organizations.id', ondelete='CASCADE'), primary_key=True),
    Column('domain_id', Integer, ForeignKey('domains.id', ondelete='CASCADE'), primary_key=True),
    Column('created_at', DateTime, default=datetime.utcnow),
    Column('created_by', Integer, ForeignKey('users.id'), nullable=True)  # User ID who added it (admin)
)


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

    # Model management fields
    model_status = Column(String(20), default="not_loaded", nullable=False)
    # Values: "loaded", "using_fallback", "missing", "downloading", "not_loaded"
    model_last_updated = Column(DateTime, nullable=True)

    # Relationships
    cameras = relationship("Camera", back_populates="domain")
    violations = relationship("Violation", back_populates="domain")
    ppe_rules = relationship("DomainPPERule", back_populates="domain")
    users = relationship("User", secondary=user_domains, back_populates="domains")
    organizations = relationship("Organization", secondary="organization_domains", back_populates="domains")

    def __repr__(self):
        return f"<Domain(id={self.id}, name='{self.name}', status='{self.status}', model_status='{self.model_status}')>"


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
    Assigned to a specific domain and organization
    """
    __tablename__ = "cameras"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)               # "Lobby Camera"
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, default=1, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    source_type = Column(SQLEnum(SourceType), nullable=False)
    source_uri = Column(String(500), nullable=False)         # "/dev/video0", "rtsp://..."
    is_active = Column(Boolean, default=True)
    location = Column(String(200), nullable=True)            # "Building A, Floor 2"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="cameras")
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
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, default=1, index=True)  # Organization ID from camera
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
    video_path = Column(String(300), nullable=True)        # Relative file path to video segment under data/videos

    # Duration tracking (IMPORTANT for notification filtering)
    duration_seconds = Column(Integer, nullable=True, default=0)  # How long the violation lasted
    # Examples:
    #   - 10 seconds = minor (person briefly removed helmet)
    #   - 1800 seconds (30 min) = serious violation
    #   - 7200 seconds (2 hours) = CRITICAL, prolonged unsafe work

    # Face Recognition (for user identification)
    detected_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Matched user
    face_match_confidence = Column(Float, nullable=True)  # Match confidence (0.0-1.0)

    # Workflow & Management
    status = Column(SQLEnum(ViolationStatus, native_enum=False), default=ViolationStatus.OPEN, index=True)
    assigned_to = Column(String(100), nullable=True)         # User email/username
    notes = Column(Text, nullable=True)                      # User notes
    corrective_action = Column(Text, nullable=True)          # Description of corrective action taken
    
    # Legacy acknowledgment (deprecated, use status instead)
    acknowledged = Column(Boolean, default=False, index=True)
    acknowledged_by = Column(String(100), nullable=True)     # Username (future)
    acknowledged_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="violations")
    camera = relationship("Camera", back_populates="violations")
    domain = relationship("Domain", back_populates="violations")
    detected_user = relationship("User", foreign_keys=[detected_user_id])
    
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
    Supports role-based and domain-based access control
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.VIEWER, nullable=False)
    
    # Organization ID (for multi-tenant support)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, default=1, index=True)
    
    # Legacy: Single domain_id (deprecated, use domains relationship instead)
    # Kept for backward compatibility and SUPER_ADMIN (null = all domains)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=True, index=True)
    
    # Additional permissions (JSON array of permission strings)
    # Example: ["violations:acknowledge", "cameras:create", "reports:export"]
    permissions = Column(JSON, default=list, nullable=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    domain = relationship("Domain", foreign_keys=[domain_id])  # Legacy single domain
    domains = relationship("Domain", secondary=user_domains, back_populates="users")  # Many-to-many

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"


class UserPhoto(Base):
    """
    User reference photos for face recognition
    Stores multiple photos per user to improve matching accuracy
    """
    __tablename__ = "user_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    photo_path = Column(String(300), nullable=False)  # Path to stored photo
    face_encoding = Column(JSON, nullable=True)  # Face encoding vector (stored as JSON array)
    is_primary = Column(Boolean, default=False)  # Primary reference photo
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who uploaded
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], backref="photos")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    
    def __repr__(self):
        return f"<UserPhoto(id={self.id}, user_id={self.user_id}, is_primary={self.is_primary})>"


class NotificationSettings(Base):
    """
    Email notification configuration settings
    Manages SMTP settings and alert preferences
    """
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)

    # SMTP Configuration
    smtp_host = Column(String(255), default="smtp.gmail.com")
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    from_email = Column(String(255), nullable=True)
    from_name = Column(String(255), default="PPE Safety System")
    use_tls = Column(Boolean, default=True)

    # Email Recipients (JSON arrays)
    alert_recipients = Column(JSON, default=list)
    summary_recipients = Column(JSON, default=list)

    # Alert Thresholds
    critical_violation_threshold = Column(Integer, default=1)
    high_violation_threshold = Column(Integer, default=3)
    bulk_violation_threshold = Column(Integer, default=10)

    # Notification Preferences
    send_immediate_alerts = Column(Boolean, default=True)
    send_daily_summary = Column(Boolean, default=True)
    send_weekly_summary = Column(Boolean, default=False)
    daily_summary_time = Column(String(5), default="08:00")

    # Master enable/disable
    enabled = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': self.id,
            'smtp_host': self.smtp_host,
            'smtp_port': self.smtp_port,
            'smtp_user': self.smtp_user,
            'from_email': self.from_email,
            'from_name': self.from_name,
            'use_tls': self.use_tls,
            'alert_recipients': self.alert_recipients or [],
            'summary_recipients': self.summary_recipients or [],
            'critical_violation_threshold': self.critical_violation_threshold,
            'high_violation_threshold': self.high_violation_threshold,
            'bulk_violation_threshold': self.bulk_violation_threshold,
            'send_immediate_alerts': self.send_immediate_alerts,
            'send_daily_summary': self.send_daily_summary,
            'send_weekly_summary': self.send_weekly_summary,
            'daily_summary_time': self.daily_summary_time,
            'enabled': self.enabled,
        }

    def __repr__(self):
        return f"<NotificationSettings(id={self.id}, enabled={self.enabled})>"


# ==========================================
# NOTIFICATION SCHEDULES
# ==========================================

class ScheduleType(str, Enum):
    """Types of notification schedules"""
    DAILY_SUMMARY = "daily_summary"           # Daily report at end of shift
    WORKER_REMINDER = "worker_reminder"       # Weekly reminder to workers with many violations
    CRITICAL_ALERT = "critical_alert"         # Real-time alert for critical situations
    WEEKLY_REPORT = "weekly_report"           # Weekly management report


class NotificationSchedule(Base):
    """
    Email notification schedules configuration
    Supports daily summaries, weekly reminders, and critical alerts
    """
    __tablename__ = "notification_schedules"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(ScheduleType), nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)

    # Schedule timing
    schedule_time = Column(String(5), nullable=True)  # "18:00" for daily/weekly
    schedule_day = Column(String(10), nullable=True)  # "Monday" for weekly schedules

    # Recipients (JSON array of email addresses)
    recipients = Column(JSON, nullable=False, default=list)

    # Schedule-specific settings (JSON)
    # For daily_summary: {"include_trends": true, "top_violators_count": 5}
    # For worker_reminder: {"min_violations": 3, "cc_manager": true}
    # For critical_alert: {"violations_threshold": 5, "time_window_hours": 1}
    settings = Column(JSON, nullable=True, default=dict)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    last_run_at = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type.value if self.type else None,
            'enabled': self.enabled,
            'schedule_time': self.schedule_time,
            'schedule_day': self.schedule_day,
            'recipients': self.recipients or [],
            'settings': self.settings or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_run_at': self.last_run_at.isoformat() if self.last_run_at else None,
        }

    def __repr__(self):
        return f"<NotificationSchedule(id={self.id}, type={self.type}, enabled={self.enabled})>"


class EmailTemplate(Base):
    """
    Email templates for different notification types
    Supports HTML and plain text with variable substitution
    """
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(ScheduleType), nullable=False, unique=True)

    # Email content
    subject = Column(String(200), nullable=False)
    body_html = Column(Text, nullable=False)  # HTML version with variables
    body_text = Column(Text, nullable=False)  # Plain text version

    # Available variables for template (JSON array)
    # e.g., ["worker_name", "violation_count", "date", "violations_list"]
    variables = Column(JSON, nullable=True, default=list)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type.value if self.type else None,
            'subject': self.subject,
            'body_html': self.body_html,
            'body_text': self.body_text,
            'variables': self.variables or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<EmailTemplate(id={self.id}, type={self.type})>"

