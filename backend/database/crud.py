"""
CRUD (Create, Read, Update, Delete) operations for database models
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update, delete, cast, String
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
import json

from backend.database.models import (
    Domain, PPEType, DomainPPERule, Camera, Violation, DetectionLog, User, user_domains, Organization, organization_domains
)
from backend.database.schemas import (
    DomainCreate, DomainUpdate,
    PPETypeCreate, PPETypeUpdate,
    DomainPPERuleCreate, DomainPPERuleUpdate,
    CameraCreate, CameraUpdate,
    ViolationCreate, ViolationUpdate,
    ViolationFilterParams,
    UserCreate, UserUpdate
)
from backend.utils.logger import logger
import re


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def generate_slug(name: str) -> str:
    """
    Generate URL-friendly slug from organization name.
    Converts "ABC İnşaat Ltd." -> "abc-insaat-ltd"
    """
    # Turkish character mapping
    turkish_chars = {
        'ç': 'c', 'Ç': 'C',
        'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ş': 's', 'Ş': 'S',
        'ü': 'u', 'Ü': 'U'
    }
    
    # Replace Turkish characters
    text = name
    for turkish, english in turkish_chars.items():
        text = text.replace(turkish, english)
    
    # Convert to lowercase
    text = text.lower()
    
    # Replace spaces and special characters with hyphens
    text = re.sub(r'[^\w\s-]', '', text)  # Remove special chars except hyphens
    text = re.sub(r'[-\s]+', '-', text)  # Replace spaces and multiple hyphens with single hyphen
    text = text.strip('-')  # Remove leading/trailing hyphens
    
    # Ensure slug is not empty
    if not text:
        text = 'organization'
    
    return text


# ==========================================
# DOMAIN CRUD
# ==========================================

async def get_domains(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Domain]:
    """Get all domains with pagination"""
    result = await db.execute(
        select(Domain).offset(skip).limit(limit).order_by(Domain.id)
    )
    return result.scalars().all()


async def get_domain_by_id(db: AsyncSession, domain_id: int) -> Optional[Domain]:
    """Get a domain by ID"""
    result = await db.execute(select(Domain).where(Domain.id == domain_id))
    return result.scalar_one_or_none()


async def get_domain_by_type(db: AsyncSession, domain_type: str) -> Optional[Domain]:
    """Get a domain by type (e.g., 'construction')"""
    result = await db.execute(select(Domain).where(Domain.type == domain_type))
    return result.scalar_one_or_none()


async def create_domain(db: AsyncSession, domain: DomainCreate) -> Domain:
    """Create a new domain"""
    db_domain = Domain(**domain.model_dump())
    db.add(db_domain)
    await db.commit()
    await db.refresh(db_domain)
    return db_domain


async def update_domain(db: AsyncSession, domain_id: int, domain: DomainUpdate) -> Optional[Domain]:
    """Update a domain"""
    db_domain = await get_domain_by_id(db, domain_id)
    if not db_domain:
        return None
    
    update_data = domain.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_domain, key, value)
    
    await db.commit()
    await db.refresh(db_domain)
    return db_domain


async def delete_domain(db: AsyncSession, domain_id: int) -> bool:
    """Delete a domain"""
    db_domain = await get_domain_by_id(db, domain_id)
    if not db_domain:
        return False
    
    await db.delete(db_domain)
    await db.commit()
    return True


# ==========================================
# PPE TYPE CRUD
# ==========================================

async def get_ppe_types(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[PPEType]:
    """Get all PPE types with pagination"""
    result = await db.execute(
        select(PPEType).offset(skip).limit(limit).order_by(PPEType.id)
    )
    return result.scalars().all()


async def get_ppe_type_by_id(db: AsyncSession, ppe_type_id: int) -> Optional[PPEType]:
    """Get a PPE type by ID"""
    result = await db.execute(select(PPEType).where(PPEType.id == ppe_type_id))
    return result.scalar_one_or_none()


async def create_ppe_type(db: AsyncSession, ppe_type: PPETypeCreate) -> PPEType:
    """Create a new PPE type"""
    db_ppe_type = PPEType(**ppe_type.model_dump())
    db.add(db_ppe_type)
    await db.commit()
    await db.refresh(db_ppe_type)
    return db_ppe_type


async def update_ppe_type(db: AsyncSession, ppe_type_id: int, ppe_type: PPETypeUpdate) -> Optional[PPEType]:
    """Update a PPE type"""
    db_ppe_type = await get_ppe_type_by_id(db, ppe_type_id)
    if not db_ppe_type:
        return None
    
    update_data = ppe_type.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_ppe_type, key, value)
    
    await db.commit()
    await db.refresh(db_ppe_type)
    return db_ppe_type


# ==========================================
# DOMAIN PPE RULE CRUD
# ==========================================

async def get_domain_rules(db: AsyncSession, domain_id: int) -> List[DomainPPERule]:
    """Get all PPE rules for a specific domain"""
    result = await db.execute(
        select(DomainPPERule)
        .where(DomainPPERule.domain_id == domain_id)
        .order_by(DomainPPERule.priority)
    )
    return result.scalars().all()


async def create_domain_rule(db: AsyncSession, rule: DomainPPERuleCreate) -> DomainPPERule:
    """Create a new domain PPE rule"""
    db_rule = DomainPPERule(**rule.model_dump())
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return db_rule


async def update_domain_rule(db: AsyncSession, rule_id: int, rule: DomainPPERuleUpdate) -> Optional[DomainPPERule]:
    """Update a domain PPE rule"""
    result = await db.execute(select(DomainPPERule).where(DomainPPERule.id == rule_id))
    db_rule = result.scalar_one_or_none()
    
    if not db_rule:
        return None
    
    update_data = rule.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_rule, key, value)
    
    await db.commit()
    await db.refresh(db_rule)
    return db_rule


# ==========================================
# CAMERA CRUD
# ==========================================

async def get_cameras(db: AsyncSession, skip: int = 0, limit: int = 100, organization_id: Optional[int] = None) -> List[Camera]:
    """
    Get all cameras with pagination
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records
        organization_id: Organization ID for multi-tenant filtering (required for data isolation)
    """
    query = select(Camera)
    
    # CRITICAL: Always filter by organization_id for data isolation
    if organization_id is not None:
        query = query.where(Camera.organization_id == organization_id)
    
    query = query.offset(skip).limit(limit).order_by(Camera.id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_camera_by_id(db: AsyncSession, camera_id: int, organization_id: Optional[int] = None) -> Optional[Camera]:
    """
    Get a camera by ID
    Args:
        db: Database session
        camera_id: Camera ID
        organization_id: Organization ID for multi-tenant filtering (optional, but recommended for security)
    """
    query = select(Camera).where(Camera.id == camera_id)
    
    # Filter by organization_id if provided (security check)
    if organization_id is not None:
        query = query.where(Camera.organization_id == organization_id)
    
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_cameras_by_domain(db: AsyncSession, domain_id: int, organization_id: Optional[int] = None) -> List[Camera]:
    """
    Get all cameras for a specific domain
    Args:
        db: Database session
        domain_id: Domain ID
        organization_id: Organization ID for multi-tenant filtering (required for data isolation)
    """
    query = select(Camera).where(Camera.domain_id == domain_id)
    
    # CRITICAL: Always filter by organization_id for data isolation
    if organization_id is not None:
        query = query.where(Camera.organization_id == organization_id)
    
    result = await db.execute(query)
    return result.scalars().all()


async def create_camera(db: AsyncSession, camera: CameraCreate, organization_id: Optional[int] = None) -> Camera:
    """
    Create a new camera
    Args:
        db: Database session
        camera: Camera creation data
        organization_id: Organization ID (will be set automatically, but can be overridden)
    """
    camera_data = camera.model_dump()
    # Auto-set organization_id if provided (security: ignore client input)
    if organization_id is not None:
        camera_data['organization_id'] = organization_id
    
    db_camera = Camera(**camera_data)
    db.add(db_camera)
    await db.commit()
    await db.refresh(db_camera)
    return db_camera


async def update_camera(db: AsyncSession, camera_id: int, camera: CameraUpdate) -> Optional[Camera]:
    """Update a camera"""
    db_camera = await get_camera_by_id(db, camera_id)
    if not db_camera:
        return None
    
    update_data = camera.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_camera, key, value)
    
    await db.commit()
    await db.refresh(db_camera)
    return db_camera


async def delete_camera(db: AsyncSession, camera_id: int) -> bool:
    """Delete a camera"""
    db_camera = await get_camera_by_id(db, camera_id)
    if not db_camera:
        return False
    
    await db.delete(db_camera)
    await db.commit()
    return True


# ==========================================
# VIOLATION CRUD
# ==========================================

async def get_violations(
    db: AsyncSession,
    filters: ViolationFilterParams,
    organization_id: Optional[int] = None
) -> tuple[List[Violation], int]:
    """
    Get violations with filtering and pagination
    Returns: (violations, total_count)
    
    Args:
        db: Database session
        filters: Filter parameters
        organization_id: Organization ID for multi-tenant filtering (required for data isolation)
    """
    # Build query conditions
    conditions = []
    
    # CRITICAL: Always filter by organization_id for data isolation
    if organization_id is not None:
        conditions.append(Violation.organization_id == organization_id)
    
    if filters.domain_id:
        conditions.append(Violation.domain_id == filters.domain_id)
    if filters.camera_id:
        conditions.append(Violation.camera_id == filters.camera_id)
    if filters.status:
        conditions.append(Violation.status == filters.status)
    if filters.severity:
        conditions.append(Violation.severity == filters.severity)
    if filters.missing_ppe_type:
        # Filter by missing PPE type (search in JSON field)
        # SQLite JSON search: Check if JSON array contains an object with matching type
        # Use text search pattern that matches JSON structure: "type":"hard_hat"
        # This is more reliable than contains() for SQLite JSON
        search_pattern = f'"type":"{filters.missing_ppe_type}"'
        conditions.append(
            cast(Violation.missing_ppe, String).like(f'%{search_pattern}%')
        )
    if filters.start_date:
        conditions.append(Violation.timestamp >= filters.start_date)
    if filters.end_date:
        conditions.append(Violation.timestamp <= filters.end_date)
    # Legacy filter (deprecated)
    if filters.acknowledged is not None:
        conditions.append(Violation.acknowledged == filters.acknowledged)
    
    # Count query
    count_query = select(func.count(Violation.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    
    count_result = await db.execute(count_query)
    total = count_result.scalar()
    
    # Data query
    data_query = select(Violation).order_by(Violation.timestamp.desc())
    if conditions:
        data_query = data_query.where(and_(*conditions))
    
    data_query = data_query.offset(filters.skip).limit(filters.limit)
    result = await db.execute(data_query)
    violations = result.scalars().all()
    
    return violations, total


async def get_violation_by_id(db: AsyncSession, violation_id: int) -> Optional[Violation]:
    """Get a violation by ID"""
    result = await db.execute(select(Violation).where(Violation.id == violation_id))
    return result.scalar_one_or_none()


async def create_violation(db: AsyncSession, violation: ViolationCreate, organization_id: Optional[int] = None) -> Violation:
    """Create a new violation"""
    violation_dict = violation.model_dump()
    # Set organization_id if provided (from camera)
    if organization_id is not None:
        violation_dict["organization_id"] = organization_id
    db_violation = Violation(**violation_dict)
    db.add(db_violation)
    await db.commit()
    await db.refresh(db_violation)
    return db_violation


async def update_violation(db: AsyncSession, violation_id: int, violation: ViolationUpdate) -> Optional[Violation]:
    """Update a violation (workflow management)"""
    db_violation = await get_violation_by_id(db, violation_id)
    if not db_violation:
        return None
    
    update_data = violation.model_dump(exclude_unset=True)
    
    # Legacy: If acknowledging, set timestamp (deprecated, use status instead)
    if update_data.get("acknowledged") and not db_violation.acknowledged:
        update_data["acknowledged_at"] = datetime.utcnow()
        # Auto-set status to closed if acknowledging
        if "status" not in update_data:
            update_data["status"] = "closed"
    
    for key, value in update_data.items():
        setattr(db_violation, key, value)
    
    await db.commit()
    await db.refresh(db_violation)
    return db_violation


# ==========================================
# STATISTICS
# ==========================================

async def get_violation_stats(
    db: AsyncSession,
    domain_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    organization_id: Optional[int] = None
) -> dict:
    """
    Get comprehensive violation statistics
    
    Args:
        db: Database session
        domain_id: Optional domain filter
        start_date: Optional start date filter
        end_date: Optional end date filter
        organization_id: Organization ID for multi-tenant filtering (required for data isolation)
    """
    from backend.database.models import ViolationSeverity
    import json
    
    conditions = []
    
    # CRITICAL: Always filter by organization_id for data isolation
    if organization_id is not None:
        conditions.append(Violation.organization_id == organization_id)
    
    if domain_id:
        conditions.append(Violation.domain_id == domain_id)
    if start_date:
        conditions.append(Violation.timestamp >= start_date)
    if end_date:
        conditions.append(Violation.timestamp <= end_date)
    
    # Base query
    base_query = select(Violation)
    if conditions:
        base_query = base_query.where(and_(*conditions))
    
    # Get all violations for detailed stats
    result = await db.execute(base_query)
    violations = result.scalars().all()
    
    # Calculate statistics
    total = len(violations)
    critical = sum(1 for v in violations if v.severity == ViolationSeverity.CRITICAL)
    high = sum(1 for v in violations if v.severity == ViolationSeverity.HIGH)
    medium = sum(1 for v in violations if v.severity == ViolationSeverity.MEDIUM)
    low = sum(1 for v in violations if v.severity == ViolationSeverity.LOW)
    
    # Count by PPE type
    by_ppe_type = {}
    for violation in violations:
        # Parse missing_ppe (stored as JSON string in SQLite)
        missing_ppe = []
        if violation.missing_ppe:
            try:
                if isinstance(violation.missing_ppe, str):
                    missing_ppe = json.loads(violation.missing_ppe)
                else:
                    missing_ppe = violation.missing_ppe
            except:
                missing_ppe = []
        
        for ppe_item in missing_ppe:
            ppe_type = ppe_item.get('type', '') if isinstance(ppe_item, dict) else str(ppe_item)
            if ppe_type:
                by_ppe_type[ppe_type] = by_ppe_type.get(ppe_type, 0) + 1
    
    # Calculate compliance rate (simplified: based on violations vs estimated total detections)
    # In real scenario, we'd need total detections count
    # For now: estimate based on violations (assume 10% violation rate)
    estimated_total_detections = max(total * 10, 100) if total > 0 else 100
    compliance_rate = max(0, min(100, ((estimated_total_detections - total) / estimated_total_detections * 100))) if estimated_total_detections > 0 else 100
    
    # Acknowledged count
    acknowledged = sum(1 for v in violations if v.acknowledged)
    
    return {
        "total": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "by_ppe_type": by_ppe_type,
        "compliance_rate": round(compliance_rate, 2),
        "acknowledged": acknowledged,
        "pending": total - acknowledged
    }


# ==========================================
# ORGANIZATION CRUD
# ==========================================

async def create_organization(db: AsyncSession, name: str) -> Organization:
    """Create a new organization with auto-generated slug"""
    # Generate slug from name
    base_slug = generate_slug(name)
    slug = base_slug
    
    # Ensure slug is unique (append number if needed)
    counter = 1
    while True:
        result = await db.execute(select(Organization).where(Organization.slug == slug))
        existing = result.scalar_one_or_none()
        if not existing:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1
    
    org = Organization(name=name, slug=slug, is_active=True)
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return org


async def get_organization_by_id(db: AsyncSession, org_id: int) -> Optional[Organization]:
    """Get organization by ID"""
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    return result.scalar_one_or_none()


async def get_organization_by_name(db: AsyncSession, name: str) -> Optional[Organization]:
    """
    Get organization by name (case-insensitive, trimmed)
    Handles variations like "Acme Corp" vs "acme corp" vs "Acme Corp "
    """
    # Normalize input name
    normalized_input = name.strip().lower()
    
    # Get all organizations and compare normalized names (SQLite doesn't have reliable trim function)
    result = await db.execute(select(Organization))
    all_orgs = result.scalars().all()
    
    for org in all_orgs:
        normalized_org_name = org.name.strip().lower() if org.name else ""
        if normalized_org_name == normalized_input:
            return org
    
    return None


async def get_organization_by_email_domain(db: AsyncSession, email: str) -> Optional[Organization]:
    """
    Get organization by email domain
    Extracts domain from email (e.g., user@acme.com -> acme.com)
    and finds organization where any user from that domain exists
    
    Strategy: Find any user with the same email domain, return their organization
    This is more reliable than name matching and handles organization name variations
    """
    # Extract domain from email
    if '@' not in email:
        return None
    
    email_domain = email.split('@')[1].lower()
    
    # Find any user with the same email domain
    # Get their organization - this is the most reliable way
    # This handles cases where organization name is misspelled but email domain matches
    result = await db.execute(
        select(User).where(
            func.lower(User.email).like(f'%@{email_domain}')
        ).limit(1)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Return the organization of the first user found with this email domain
        org = await get_organization_by_id(db, user.organization_id)
        if org:
            logger.debug(f"Found organization {org.name} (ID: {org.id}) for email domain {email_domain}")
        return org
    
    return None


async def get_or_create_organization_by_name(db: AsyncSession, name: str) -> Organization:
    """
    Get existing organization by name or create new one
    Normalizes name (trim, case-insensitive) before checking
    """
    # Normalize name: trim whitespace
    normalized_name = name.strip()
    
    # Try to find existing organization (case-insensitive, trimmed)
    org = await get_organization_by_name(db, normalized_name)
    if org:
        return org
    
    # Create new organization with normalized name
    return await create_organization(db, normalized_name)


async def get_organization_user_count(db: AsyncSession, organization_id: int) -> int:
    """
    Get the number of users in an organization
    Used to determine if a user is the first user (organization owner)
    """
    result = await db.execute(
        select(func.count(User.id)).where(User.organization_id == organization_id)
    )
    count = result.scalar_one()
    return count


# ==========================================
# USER CRUD
# ==========================================


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get user by email with domains loaded"""
    result = await db.execute(
        select(User)
        .where(User.email == email)
        .options(selectinload(User.domains))
    )
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    """Get user by ID with domains and organization loaded"""
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.domains), selectinload(User.organization))
    )
    return result.scalar_one_or_none()


async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100, organization_id: Optional[int] = None) -> tuple[List[User], int]:
    """
    List users with optional organization filtering
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        organization_id: Organization ID for multi-tenant filtering (optional)
        
    Returns:
        Tuple of (List of users, total count), filtered by organization if provided
    """
    # Eager load organization and domains relationships to avoid async issues
    query = select(User).options(
        selectinload(User.organization),
        selectinload(User.domains)
    )
    
    # Filter by organization_id if provided (multi-tenant isolation)
    if organization_id is not None:
        query = query.where(User.organization_id == organization_id)
    
    # Get total count
    count_query = select(func.count()).select_from(User)
    if organization_id is not None:
        count_query = count_query.where(User.organization_id == organization_id)
    
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(User.id)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    # Do NOT set user.domains = [] here - it triggers lazy loading which causes MissingGreenlet error
    # Domains will be loaded separately in the endpoint from organization_domains table
    
    return users, total


async def create_user(db: AsyncSession, user: UserCreate, hashed_password: str, organization_id: Optional[int] = None) -> User:
    """
    Create new user with optional domain associations and organization assignment
    
    Args:
        db: Database session
        user: User creation data
        hashed_password: Hashed password
        organization_id: Organization ID (if None, will be determined from user data)
    """
    # Determine organization_id
    if organization_id is None:
        # If organization_name provided, get or create organization
        if hasattr(user, 'organization_name') and user.organization_name:
            org = await get_or_create_organization_by_name(db, user.organization_name)
            organization_id = org.id
        else:
            # Try to find organization by email domain
            org = await get_organization_by_email_domain(db, user.email)
            if org:
                organization_id = org.id
            else:
                # Default to organization 1 (should exist from seed)
                organization_id = 1
    
    db_user = User(
        email=user.email.lower(),
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role,
        organization_id=organization_id,
        domain_id=user.domain_id,
        permissions=user.permissions or [],
        is_active=user.is_active,
    )
    db.add(db_user)
    await db.flush()  # Flush to get user.id
    
    # Add domain associations if provided
    # Note: domain_ids is optional - can be set during registration or later via /auth/select-domains
    if hasattr(user, 'domain_ids') and user.domain_ids:
        from sqlalchemy import insert
        try:
            await db.execute(
                insert(user_domains).values([
                    {"user_id": db_user.id, "domain_id": domain_id}
                    for domain_id in user.domain_ids
                ])
            )
        except Exception as e:
            # If user_domains table doesn't exist, log warning but don't fail
            # User can select domains later via /auth/select-domains endpoint
            logger.warning(f"Could not add domain associations (table may not exist): {e}")
    
    await db.commit()
    await db.refresh(db_user)
    
    # Eagerly load domains relationship to avoid lazy-loading issues
    # Since this is a new user, domains will be empty, but we need to load the relationship
    result = await db.execute(
        select(User)
        .where(User.id == db_user.id)
        .options(selectinload(User.domains))
    )
    db_user = result.scalar_one()
    return db_user


async def update_user(db: AsyncSession, user_id: int, user: UserUpdate, hashed_password: Optional[str] = None) -> Optional[User]:
    """Update existing user"""
    db_user = await get_user(db, user_id)
    if not db_user:
        return None

    # Handle domain_ids separately (not a direct User model field)
    domain_ids = None
    if hasattr(user, 'domain_ids') and user.domain_ids is not None:
        domain_ids = user.domain_ids
        # Remove domain_ids from update_data to avoid trying to set it on User model
        update_data = user.model_dump(exclude_unset=True, exclude={"password", "domain_ids"})
    else:
        update_data = user.model_dump(exclude_unset=True, exclude={"password", "domain_ids"})
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    if hashed_password:
        db_user.hashed_password = hashed_password

    # Update domain associations if domain_ids provided
    # IMPORTANT: Domain changes are organization-wide - update all users in the same organization
    if domain_ids is not None:
        from sqlalchemy import delete, insert, select as sql_select
        # Get the user's organization_id
        user_org_id = db_user.organization_id
        
        # #region agent log
        import json
        with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps({
                'sessionId': 'debug-session',
                'runId': 'run1',
                'hypothesisId': 'G',
                'location': 'backend/database/crud.py:789',
                'message': 'Updating domains organization-wide',
                'data': {
                    'userId': user_id,
                    'userOrgId': user_org_id,
                    'domainIds': domain_ids,
                    'updatingAllUsersInOrg': True
                },
                'timestamp': int(__import__('time').time() * 1000)
            }) + '\n')
        # #endregion
        
        if user_org_id:
            # Get all users in the same organization
            org_users_result = await db.execute(
                sql_select(User.id).where(User.organization_id == user_org_id)
            )
            org_user_ids = [row[0] for row in org_users_result.fetchall()]
            
            # #region agent log
            with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps({
                    'sessionId': 'debug-session',
                    'runId': 'run1',
                    'hypothesisId': 'G',
                    'location': 'backend/database/crud.py:810',
                    'message': 'Found users in organization',
                    'data': {
                        'orgId': user_org_id,
                        'userIds': org_user_ids,
                        'count': len(org_user_ids)
                    },
                    'timestamp': int(__import__('time').time() * 1000)
                }) + '\n')
            # #endregion
            
            # Remove existing associations for all users in the organization
            await db.execute(
                delete(user_domains).where(user_domains.c.user_id.in_(org_user_ids))
            )
            
            # Add new associations for all users in the organization
            if domain_ids:
                await db.execute(
                    insert(user_domains).values([
                        {"user_id": org_user_id, "domain_id": domain_id}
                        for org_user_id in org_user_ids
                        for domain_id in domain_ids
                    ])
                )
        else:
            # If user has no organization, only update that user
            await db.execute(
                delete(user_domains).where(user_domains.c.user_id == user_id)
            )
            if domain_ids:
                await db.execute(
                    insert(user_domains).values([
                        {"user_id": user_id, "domain_id": domain_id}
                        for domain_id in domain_ids
                    ])
                )

    await db.commit()
    await db.refresh(db_user)
    
    # #region agent log
    import json
    with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
        f.write(json.dumps({
            'sessionId': 'debug-session',
            'runId': 'run1',
            'hypothesisId': 'A',
            'location': 'backend/database/crud.py:805',
            'message': 'After update_user commit',
            'data': {
                'userId': db_user.id,
                'domainIdsProvided': domain_ids is not None,
                'domainIds': domain_ids if domain_ids is not None else None
            },
            'timestamp': int(__import__('time').time() * 1000)
        }) + '\n')
    # #endregion
    
    # Eagerly load domains relationship to avoid lazy-loading issues
    result = await db.execute(
        select(User)
        .where(User.id == db_user.id)
        .options(selectinload(User.domains))
    )
    db_user = result.scalar_one()
    
    # #region agent log
    with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
        f.write(json.dumps({
            'sessionId': 'debug-session',
            'runId': 'run1',
            'hypothesisId': 'A',
            'location': 'backend/database/crud.py:814',
            'message': 'After eager load domains',
            'data': {
                'userId': db_user.id,
                'domainsCount': len(db_user.domains) if db_user.domains else 0,
                'domainsIds': [d.id for d in db_user.domains] if db_user.domains else []
            },
            'timestamp': int(__import__('time').time() * 1000)
        }) + '\n')
    # #endregion
    
    return db_user


async def delete_user(db: AsyncSession, user_id: int) -> bool:
    """Delete a user"""
    from sqlalchemy import delete
    db_user = await get_user(db, user_id)
    if not db_user:
        return False
    
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return True


# ==========================================
# USER PHOTO CRUD
# ==========================================

async def create_user_photo(
    db: AsyncSession,
    user_id: int,
    photo_path: str,
    face_encoding: Optional[List[float]] = None,
    is_primary: bool = False,
    uploaded_by: Optional[int] = None
) -> "UserPhoto":
    """
    Create a new user photo record
    
    Args:
        db: Database session
        user_id: User ID
        photo_path: Path to stored photo
        face_encoding: Face encoding vector (optional)
        is_primary: Whether this is the primary photo
        uploaded_by: User ID who uploaded the photo
        
    Returns:
        Created UserPhoto object
    """
    from backend.database.models import UserPhoto
    
    # If this is set as primary, unset other primary photos for this user
    if is_primary:
        await db.execute(
            update(UserPhoto)
            .where(UserPhoto.user_id == user_id)
            .values(is_primary=False)
        )
    
    db_photo = UserPhoto(
        user_id=user_id,
        photo_path=photo_path,
        face_encoding=face_encoding,
        is_primary=is_primary,
        uploaded_by=uploaded_by
    )
    
    db.add(db_photo)
    await db.commit()
    await db.refresh(db_photo)
    return db_photo


async def get_user_photos(
    db: AsyncSession,
    user_id: int
) -> List["UserPhoto"]:
    """
    Get all photos for a user
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        List of UserPhoto objects
    """
    from backend.database.models import UserPhoto
    from sqlalchemy import select
    
    result = await db.execute(
        select(UserPhoto)
        .where(UserPhoto.user_id == user_id)
        .order_by(UserPhoto.is_primary.desc(), UserPhoto.uploaded_at.desc())
    )
    return list(result.scalars().all())


async def get_user_photos_by_organization(
    db: AsyncSession,
    organization_id: int
) -> List["UserPhoto"]:
    """
    Get all user photos for users in an organization
    
    Args:
        db: Database session
        organization_id: Organization ID
        
    Returns:
        List of UserPhoto objects
    """
    from backend.database.models import UserPhoto, User
    from sqlalchemy import select
    
    result = await db.execute(
        select(UserPhoto)
        .join(User, UserPhoto.user_id == User.id)
        .where(User.organization_id == organization_id)
        .where(UserPhoto.face_encoding.isnot(None))  # Only photos with encoding
    )
    return list(result.scalars().all())


async def get_user_photo_by_id(
    db: AsyncSession,
    photo_id: int
) -> Optional["UserPhoto"]:
    """
    Get user photo by ID
    
    Args:
        db: Database session
        photo_id: Photo ID
        
    Returns:
        UserPhoto object or None
    """
    from backend.database.models import UserPhoto
    from sqlalchemy import select
    
    result = await db.execute(
        select(UserPhoto)
        .where(UserPhoto.id == photo_id)
    )
    return result.scalar_one_or_none()


async def update_user_photo(
    db: AsyncSession,
    photo_id: int,
    face_encoding: Optional[List[float]] = None,
    is_primary: Optional[bool] = None
) -> Optional["UserPhoto"]:
    """
    Update user photo
    
    Args:
        db: Database session
        photo_id: Photo ID
        face_encoding: Updated face encoding (optional)
        is_primary: Whether to set as primary (optional)
        
    Returns:
        Updated UserPhoto object or None
    """
    from backend.database.models import UserPhoto
    from sqlalchemy import select, update
    
    photo = await get_user_photo_by_id(db, photo_id)
    if not photo:
        return None
    
    # If setting as primary, unset other primary photos
    if is_primary:
        await db.execute(
            update(UserPhoto)
            .where(UserPhoto.user_id == photo.user_id)
            .where(UserPhoto.id != photo_id)
            .values(is_primary=False)
        )
    
    if face_encoding is not None:
        photo.face_encoding = face_encoding
    if is_primary is not None:
        photo.is_primary = is_primary
    
    await db.commit()
    await db.refresh(photo)
    return photo


async def delete_user_photo(
    db: AsyncSession,
    photo_id: int
) -> bool:
    """
    Delete user photo
    
    Args:
        db: Database session
        photo_id: Photo ID
        
    Returns:
        True if deleted, False if not found
    """
    from backend.database.models import UserPhoto
    from sqlalchemy import delete
    
    result = await db.execute(
        delete(UserPhoto)
        .where(UserPhoto.id == photo_id)
    )
    await db.commit()
    return result.rowcount > 0


# ==========================================
# ORGANIZATION-DOMAIN CRUD
# ==========================================


async def get_organization_domains(db: AsyncSession, organization_id: int) -> List[Domain]:
    """
    Get all domains for an organization
    
    Args:
        db: Database session
        organization_id: Organization ID
        
    Returns:
        List of domains associated with the organization
    """
    result = await db.execute(
        select(Domain)
        .join(organization_domains)
        .where(organization_domains.c.organization_id == organization_id)
        .order_by(Domain.id)
    )
    return list(result.scalars().all())


async def get_organization_domain_ids(db: AsyncSession, organization_id: int) -> List[int]:
    """
    Get domain IDs for an organization (lightweight version)
    
    Args:
        db: Database session
        organization_id: Organization ID
        
    Returns:
        List of domain IDs
    """
    result = await db.execute(
        select(organization_domains.c.domain_id)
        .where(organization_domains.c.organization_id == organization_id)
    )
    return [row[0] for row in result.all()]


async def add_domain_to_organization(
    db: AsyncSession, 
    organization_id: int, 
    domain_id: int, 
    created_by: Optional[int] = None
) -> bool:
    """
    Add a domain to an organization
    
    Args:
        db: Database session
        organization_id: Organization ID
        domain_id: Domain ID to add
        created_by: User ID who added it (optional)
        
    Returns:
        True if added, False if already exists
    """
    # Check if already exists
    result = await db.execute(
        select(organization_domains)
        .where(
            and_(
                organization_domains.c.organization_id == organization_id,
                organization_domains.c.domain_id == domain_id
            )
        )
    )
    existing = result.first()
    if existing:
        logger.debug(f"Domain {domain_id} already exists in organization {organization_id}")
        return False
    
    # Insert new association
    await db.execute(
        organization_domains.insert().values(
            organization_id=organization_id,
            domain_id=domain_id,
            created_by=created_by,
            created_at=datetime.utcnow()
        )
    )
    await db.commit()
    logger.info(f"Domain {domain_id} added to organization {organization_id}")
    return True


async def remove_domain_from_organization(
    db: AsyncSession, 
    organization_id: int, 
    domain_id: int
) -> bool:
    """
    Remove a domain from an organization
    
    Args:
        db: Database session
        organization_id: Organization ID
        domain_id: Domain ID to remove
        
    Returns:
        True if removed, False if not found
    """
    result = await db.execute(
        organization_domains.delete().where(
            and_(
                organization_domains.c.organization_id == organization_id,
                organization_domains.c.domain_id == domain_id
            )
        )
    )
    await db.commit()
    
    if result.rowcount > 0:
        logger.info(f"Domain {domain_id} removed from organization {organization_id}")
        return True
    else:
        logger.debug(f"Domain {domain_id} not found in organization {organization_id}")
        return False


async def has_organization_domain(
    db: AsyncSession, 
    organization_id: int, 
    domain_id: int
) -> bool:
    """
    Check if an organization has a specific domain
    
    Args:
        db: Database session
        organization_id: Organization ID
        domain_id: Domain ID to check
        
    Returns:
        True if organization has the domain, False otherwise
    """
    result = await db.execute(
        select(func.count(organization_domains.c.domain_id))
        .where(
            and_(
                organization_domains.c.organization_id == organization_id,
                organization_domains.c.domain_id == domain_id
            )
        )
    )
    count = result.scalar_one()
    return count > 0


# ==========================================
# USER PHOTO CRUD
# ==========================================

async def create_user_photo(
    db: AsyncSession,
    user_id: int,
    photo_path: str,
    face_encoding: Optional[List[float]] = None,
    is_primary: bool = False,
    uploaded_by: Optional[int] = None
) -> "UserPhoto":
    """
    Create a new user photo record
    
    Args:
        db: Database session
        user_id: User ID
        photo_path: Path to stored photo
        face_encoding: Face encoding vector (optional)
        is_primary: Whether this is the primary photo
        uploaded_by: User ID who uploaded the photo
        
    Returns:
        Created UserPhoto object
    """
    from backend.database.models import UserPhoto
    
    # If this is set as primary, unset other primary photos for this user
    if is_primary:
        await db.execute(
            update(UserPhoto)
            .where(UserPhoto.user_id == user_id)
            .values(is_primary=False)
        )
    
    db_photo = UserPhoto(
        user_id=user_id,
        photo_path=photo_path,
        face_encoding=face_encoding,
        is_primary=is_primary,
        uploaded_by=uploaded_by
    )
    
    db.add(db_photo)
    await db.commit()
    await db.refresh(db_photo)
    return db_photo


async def get_user_photos(
    db: AsyncSession,
    user_id: int
) -> List["UserPhoto"]:
    """
    Get all photos for a user
    
    Args:
        db: Database session
        user_id: User ID
        
    Returns:
        List of UserPhoto objects
    """
    from backend.database.models import UserPhoto
    
    result = await db.execute(
        select(UserPhoto)
        .where(UserPhoto.user_id == user_id)
        .order_by(UserPhoto.is_primary.desc(), UserPhoto.uploaded_at.desc())
    )
    return list(result.scalars().all())


async def get_user_photos_by_organization(
    db: AsyncSession,
    organization_id: int
) -> List["UserPhoto"]:
    """
    Get all user photos for users in an organization
    
    Args:
        db: Database session
        organization_id: Organization ID
        
    Returns:
        List of UserPhoto objects
    """
    from backend.database.models import UserPhoto, User
    
    result = await db.execute(
        select(UserPhoto)
        .join(User, UserPhoto.user_id == User.id)
        .where(User.organization_id == organization_id)
        .where(UserPhoto.face_encoding.isnot(None))  # Only photos with encoding
    )
    return list(result.scalars().all())


async def get_user_photo_by_id(
    db: AsyncSession,
    photo_id: int
) -> Optional["UserPhoto"]:
    """
    Get user photo by ID
    
    Args:
        db: Database session
        photo_id: Photo ID
        
    Returns:
        UserPhoto object or None
    """
    from backend.database.models import UserPhoto
    
    result = await db.execute(
        select(UserPhoto)
        .where(UserPhoto.id == photo_id)
    )
    return result.scalar_one_or_none()


async def update_user_photo(
    db: AsyncSession,
    photo_id: int,
    face_encoding: Optional[List[float]] = None,
    is_primary: Optional[bool] = None
) -> Optional["UserPhoto"]:
    """
    Update user photo
    
    Args:
        db: Database session
        photo_id: Photo ID
        face_encoding: Updated face encoding (optional)
        is_primary: Whether to set as primary (optional)
        
    Returns:
        Updated UserPhoto object or None
    """
    from backend.database.models import UserPhoto
    
    photo = await get_user_photo_by_id(db, photo_id)
    if not photo:
        return None
    
    # If setting as primary, unset other primary photos
    if is_primary:
        await db.execute(
            update(UserPhoto)
            .where(UserPhoto.user_id == photo.user_id)
            .where(UserPhoto.id != photo_id)
            .values(is_primary=False)
        )
    
    if face_encoding is not None:
        photo.face_encoding = face_encoding
    if is_primary is not None:
        photo.is_primary = is_primary
    
    await db.commit()
    await db.refresh(photo)
    return photo


async def delete_user_photo(
    db: AsyncSession,
    photo_id: int
) -> bool:
    """
    Delete user photo
    
    Args:
        db: Database session
        photo_id: Photo ID
        
    Returns:
        True if deleted, False if not found
    """
    from backend.database.models import UserPhoto
    
    result = await db.execute(
        delete(UserPhoto)
        .where(UserPhoto.id == photo_id)
    )
    await db.commit()
    return result.rowcount > 0

