"""
CRUD (Create, Read, Update, Delete) operations for database models
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from backend.database.models import (
    Domain, PPEType, DomainPPERule, Camera, Violation, DetectionLog, User
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

async def get_cameras(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Camera]:
    """Get all cameras with pagination"""
    result = await db.execute(
        select(Camera).offset(skip).limit(limit).order_by(Camera.id)
    )
    return result.scalars().all()


async def get_camera_by_id(db: AsyncSession, camera_id: int) -> Optional[Camera]:
    """Get a camera by ID"""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    return result.scalar_one_or_none()


async def get_cameras_by_domain(db: AsyncSession, domain_id: int) -> List[Camera]:
    """Get all cameras for a specific domain"""
    result = await db.execute(
        select(Camera).where(Camera.domain_id == domain_id)
    )
    return result.scalars().all()


async def create_camera(db: AsyncSession, camera: CameraCreate) -> Camera:
    """Create a new camera"""
    db_camera = Camera(**camera.model_dump())
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
    filters: ViolationFilterParams
) -> tuple[List[Violation], int]:
    """
    Get violations with filtering and pagination
    Returns: (violations, total_count)
    """
    # Build query conditions
    conditions = []
    if filters.domain_id:
        conditions.append(Violation.domain_id == filters.domain_id)
    if filters.camera_id:
        conditions.append(Violation.camera_id == filters.camera_id)
    if filters.acknowledged is not None:
        conditions.append(Violation.acknowledged == filters.acknowledged)
    if filters.severity:
        conditions.append(Violation.severity == filters.severity)
    if filters.start_date:
        conditions.append(Violation.timestamp >= filters.start_date)
    if filters.end_date:
        conditions.append(Violation.timestamp <= filters.end_date)
    
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


async def create_violation(db: AsyncSession, violation: ViolationCreate) -> Violation:
    """Create a new violation"""
    db_violation = Violation(**violation.model_dump())
    db.add(db_violation)
    await db.commit()
    await db.refresh(db_violation)
    return db_violation


async def update_violation(db: AsyncSession, violation_id: int, violation: ViolationUpdate) -> Optional[Violation]:
    """Update a violation (typically for acknowledgment)"""
    db_violation = await get_violation_by_id(db, violation_id)
    if not db_violation:
        return None
    
    update_data = violation.model_dump(exclude_unset=True)
    
    # If acknowledging, set timestamp
    if update_data.get("acknowledged") and not db_violation.acknowledged:
        update_data["acknowledged_at"] = datetime.utcnow()
    
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
    end_date: Optional[datetime] = None
) -> dict:
    """Get violation statistics"""
    conditions = []
    if domain_id:
        conditions.append(Violation.domain_id == domain_id)
    if start_date:
        conditions.append(Violation.timestamp >= start_date)
    if end_date:
        conditions.append(Violation.timestamp <= end_date)
    
    # Total violations
    total_query = select(func.count(Violation.id))
    if conditions:
        total_query = total_query.where(and_(*conditions))
    
    total_result = await db.execute(total_query)
    total_violations = total_result.scalar()
    
    # Acknowledged count
    ack_query = select(func.count(Violation.id)).where(Violation.acknowledged == True)
    if conditions:
        ack_query = ack_query.where(and_(*conditions))
    
    ack_result = await db.execute(ack_query)
    acknowledged = ack_result.scalar()
    
    return {
        "total_violations": total_violations,
        "acknowledged": acknowledged,
        "pending": total_violations - acknowledged
    }


# ==========================================
# USER CRUD
# ==========================================


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get user by email"""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: int) -> Optional[User]:
    """Get user by ID"""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
    """List users"""
    result = await db.execute(
        select(User).offset(skip).limit(limit).order_by(User.id)
    )
    return result.scalars().all()


async def create_user(db: AsyncSession, user: UserCreate, hashed_password: str) -> User:
    """Create new user"""
    db_user = User(
        email=user.email.lower(),
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role,
        is_active=user.is_active,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def update_user(db: AsyncSession, user_id: int, user: UserUpdate, hashed_password: Optional[str] = None) -> Optional[User]:
    """Update existing user"""
    db_user = await get_user(db, user_id)
    if not db_user:
        return None

    update_data = user.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    if hashed_password:
        db_user.hashed_password = hashed_password

    await db.commit()
    await db.refresh(db_user)
    return db_user

