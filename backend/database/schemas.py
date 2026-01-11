"""
Pydantic schemas for request/response validation
Separate from SQLAlchemy models for clean API layer
"""

from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List, TypeVar, Generic

T = TypeVar('T')
from datetime import datetime
from backend.database.models import DomainStatus, SourceType, ViolationSeverity, ViolationStatus, UserRole


# ==========================================
# DOMAIN SCHEMAS
# ==========================================

class DomainBase(BaseModel):
    """Base domain fields"""
    name: str = Field(..., min_length=1, max_length=100, description="Domain display name")
    type: str = Field(..., min_length=1, max_length=50, description="Domain type identifier")
    icon: Optional[str] = Field(None, max_length=10, description="Emoji icon")
    description: Optional[str] = Field(None, description="Domain description")
    status: DomainStatus = Field(default=DomainStatus.PLANNED, description="Domain status")


class DomainCreate(DomainBase):
    """Schema for creating a new domain"""
    pass


class DomainUpdate(BaseModel):
    """Schema for updating a domain (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[str] = Field(None, min_length=1, max_length=50)
    icon: Optional[str] = Field(None, max_length=10)
    description: Optional[str] = None
    status: Optional[DomainStatus] = None


class DomainResponse(DomainBase):
    """Schema for domain response"""
    id: int
    created_at: datetime
    model_status: Optional[str] = Field(default="not_loaded", description="Model loading status")
    model_last_updated: Optional[datetime] = Field(None, description="Last time model was updated")

    model_config = ConfigDict(from_attributes=True, protected_namespaces=())


# ==========================================
# PPE TYPE SCHEMAS
# ==========================================

class PPETypeBase(BaseModel):
    """Base PPE type fields"""
    name: str = Field(..., min_length=1, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., min_length=1, max_length=20, description="head, eye, hand, etc.")
    model_class_name: Optional[str] = Field(None, max_length=50, description="YOLO class name")
    status: DomainStatus = Field(default=DomainStatus.ACTIVE)


class PPETypeCreate(PPETypeBase):
    """Schema for creating a new PPE type"""
    pass


class PPETypeUpdate(BaseModel):
    """Schema for updating a PPE type"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    category: Optional[str] = Field(None, min_length=1, max_length=20)
    model_class_name: Optional[str] = Field(None, max_length=50)
    status: Optional[DomainStatus] = None


class PPETypeResponse(PPETypeBase):
    """Schema for PPE type response"""
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# DOMAIN PPE RULE SCHEMAS
# ==========================================

class DomainPPERuleBase(BaseModel):
    """Base domain PPE rule fields"""
    domain_id: int = Field(..., gt=0)
    ppe_type_id: int = Field(..., gt=0)
    is_required: bool = Field(default=True)
    priority: int = Field(default=1, ge=1, le=5, description="1=critical, 5=low")
    warning_message: Optional[str] = Field(None, max_length=200)


class DomainPPERuleCreate(DomainPPERuleBase):
    """Schema for creating a new rule"""
    pass


class DomainPPERuleUpdate(BaseModel):
    """Schema for updating a rule"""
    is_required: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    warning_message: Optional[str] = Field(None, max_length=200)


class DomainPPERuleResponse(DomainPPERuleBase):
    """Schema for rule response"""
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# ORGANIZATION SCHEMAS
# ==========================================

class OrganizationBase(BaseModel):
    """Base organization fields"""
    name: str = Field(..., min_length=1, max_length=200, description="Organization/Company name")
    is_active: bool = Field(default=True)


class OrganizationCreate(OrganizationBase):
    """Schema for creating a new organization"""
    pass


class OrganizationResponse(OrganizationBase):
    """Schema for organization response"""
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# CAMERA SCHEMAS
# ==========================================

class CameraBase(BaseModel):
    """Base camera fields"""
    name: str = Field(..., min_length=1, max_length=100)
    domain_id: int = Field(..., gt=0)
    source_type: SourceType
    source_uri: str = Field(..., min_length=1, max_length=500, description="Webcam index, RTSP URL, or file path")
    is_active: bool = Field(default=True)
    location: Optional[str] = Field(None, max_length=200)


class CameraCreate(CameraBase):
    """Schema for creating a new camera"""
    pass


class CameraUpdate(BaseModel):
    """Schema for updating a camera"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    domain_id: Optional[int] = Field(None, gt=0)
    source_type: Optional[SourceType] = None
    source_uri: Optional[str] = Field(None, min_length=1, max_length=500)
    is_active: Optional[bool] = None
    location: Optional[str] = Field(None, max_length=200)


class CameraResponse(CameraBase):
    """Schema for camera response"""
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# VIOLATION SCHEMAS
# ==========================================

class ViolationBase(BaseModel):
    """Base violation fields"""
    camera_id: int = Field(..., gt=0)
    domain_id: int = Field(..., gt=0)
    person_bbox: dict = Field(..., description="Person bounding box {x, y, w, h}")
    detected_ppe: List[dict] = Field(..., description="Detected PPE items")
    missing_ppe: List[dict] = Field(..., description="Missing PPE items")
    track_id: Optional[int] = Field(None, description="Tracker ID for the detected person")
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: ViolationSeverity = Field(default=ViolationSeverity.MEDIUM)
    status: ViolationStatus = Field(default=ViolationStatus.OPEN, description="Workflow status")
    assigned_to: Optional[str] = Field(None, max_length=100, description="Assigned user email/username")
    notes: Optional[str] = Field(None, description="User notes")
    corrective_action: Optional[str] = Field(None, description="Corrective action taken")
    detected_user_id: Optional[int] = Field(None, description="User ID matched via face recognition")
    face_match_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Face match confidence score")
    frame_snapshot: Optional[str] = Field(
        default=None,
        description="Base64 snapshot payload (deprecated, kept for backward compatibility)"
    )
    snapshot_path: Optional[str] = Field(
        default=None,
        description="Relative path to the stored snapshot image"
    )
    video_path: Optional[str] = Field(
        default=None,
        description="Relative path to the stored video segment (MP4)"
    )


class ViolationCreate(ViolationBase):
    """Schema for creating a new violation"""
    pass


class ViolationUpdate(BaseModel):
    """Schema for updating a violation (workflow management)"""
    status: Optional[ViolationStatus] = None
    assigned_to: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    corrective_action: Optional[str] = None
    detected_user_id: Optional[int] = Field(None, description="Manually assign user ID")
    # Legacy fields (deprecated)
    acknowledged: Optional[bool] = None
    acknowledged_by: Optional[str] = Field(None, max_length=100)


class ViolationResponse(ViolationBase):
    """Schema for violation response"""
    id: int
    timestamp: datetime
    status: ViolationStatus
    assigned_to: Optional[str]
    notes: Optional[str]
    corrective_action: Optional[str]
    duration_seconds: Optional[int] = Field(None, description="Duration of violation in seconds")
    # Legacy fields (deprecated)
    acknowledged: bool
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# LIST/FILTER SCHEMAS
# ==========================================

class ViolationFilterParams(BaseModel):
    """Query parameters for filtering violations"""
    domain_id: Optional[int] = Field(None, gt=0)
    camera_id: Optional[int] = Field(None, gt=0)
    status: Optional[ViolationStatus] = None
    severity: Optional[ViolationSeverity] = None
    missing_ppe_type: Optional[str] = Field(None, description="Filter by missing PPE type (e.g., 'hard_hat', 'safety_vest')")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)
    # Legacy field (deprecated)
    acknowledged: Optional[bool] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    total: int = Field(..., description="Total number of items")
    skip: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Number of items per page")
    items: List[T] = Field(..., description="List of items")
    
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# USER & AUTH SCHEMAS
# ==========================================


class UserBase(BaseModel):
    """Shared user fields"""
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole = UserRole.VIEWER
    domain_id: Optional[int] = Field(None, description="Domain ID for domain-based access (null = all domains)")
    permissions: List[str] = Field(default_factory=list, description="Additional permissions beyond role")
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for user creation"""
    password: str = Field(..., min_length=6, max_length=100)
    organization_name: Optional[str] = Field(None, min_length=1, max_length=200, description="Organization/Company name (required for first user)")
    domain_ids: Optional[List[int]] = Field(None, description="List of domain IDs for multi-domain access")


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    role: Optional[UserRole] = None
    domain_id: Optional[int] = Field(None, description="Domain ID for domain-based access")
    domain_ids: Optional[List[int]] = Field(None, description="List of domain IDs for multi-domain access")
    permissions: Optional[List[str]] = Field(None, description="Additional permissions")
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """Response schema for user"""
    id: int
    organization_id: Optional[int] = Field(None, description="Organization ID the user belongs to")
    created_at: datetime
    last_login: Optional[datetime]
    domains: Optional[List["DomainResponse"]] = Field(None, description="User's accessible domains")

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# USER PHOTO SCHEMAS
# ==========================================

class UserPhotoBase(BaseModel):
    """Base user photo fields"""
    user_id: int = Field(..., gt=0)
    photo_path: str = Field(..., max_length=300)
    is_primary: bool = Field(default=False)


class UserPhotoCreate(UserPhotoBase):
    """Schema for creating a user photo"""
    face_encoding: Optional[List[float]] = Field(None, description="Face encoding vector")


class UserPhotoResponse(UserPhotoBase):
    """Response schema for user photo"""
    id: int
    face_encoding: Optional[List[float]] = None
    uploaded_at: datetime
    uploaded_by: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


class TokenResponse(Token):
    """Token + user payload"""
    user: UserResponse


class TokenPayload(BaseModel):
    """Payload stored inside JWT"""
    sub: int
    role: UserRole
    exp: int


class UserDomainSelection(BaseModel):
    """Schema for user domain selection"""
    domain_ids: List[int] = Field(..., min_items=1, max_items=4, description="List of domain IDs (1-4 domains)")

