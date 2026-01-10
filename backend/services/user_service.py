"""
User service for authentication and admin management
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update, delete, insert, select
from datetime import datetime

from backend.database import crud, schemas
from backend.database.models import User, UserRole, user_domains, Domain
from backend.utils.security import verify_password, get_password_hash
from backend.utils.logger import logger


class UserService:
    """Business logic for user/auth operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        return await crud.get_user_by_email(self.db, email.lower())

    async def get_by_id(self, user_id: int) -> Optional[User]:
        return await crud.get_user(self.db, user_id)

    async def list_users(self, skip: int = 0, limit: int = 100) -> List[User]:
        return await crud.get_users(self.db, skip=skip, limit=limit)

    async def create_user(self, user_in: schemas.UserCreate) -> User:
        """
        Create a new user with organization assignment
        
        Organization assignment logic:
        1. If organization_name provided → get or create organization
        2. Else if email domain matches existing org → assign to that org
        3. Else → assign to default organization (ID=1)
        
        Role assignment logic:
        - If organization has no users (first user) → ADMIN role
        - Otherwise → use role from user_in (with validation)
        """
        hashed = get_password_hash(user_in.password)
        
        # Handle organization assignment
        # PRIORITY: Email domain matching first (more reliable), then organization name
        organization_id = None
        from backend.database import crud as org_crud
        
        # Step 1: Try to find organization by email domain (MOST RELIABLE)
        org = await org_crud.get_organization_by_email_domain(self.db, user_in.email)
        if org:
            organization_id = org.id
            logger.info(f"User {user_in.email} assigned to existing organization by email domain: {org.name} (ID: {org.id})")
        # Step 2: If no email domain match, use organization_name if provided
        elif hasattr(user_in, 'organization_name') and user_in.organization_name:
            # Get or create organization by name (normalized)
            org = await org_crud.get_or_create_organization_by_name(self.db, user_in.organization_name)
            organization_id = org.id
            logger.info(f"User {user_in.email} assigned to organization by name: {org.name} (ID: {org.id})")
        
        # Determine final organization_id (default to 1 if still None)
        if organization_id is None:
            organization_id = 1
        
        # Check if this is the first user in the organization
        user_count = await org_crud.get_organization_user_count(self.db, organization_id)
        is_first_user = user_count == 0
        
        # Role assignment: First user gets ADMIN role automatically
        final_role = user_in.role
        if is_first_user:
            final_role = UserRole.ADMIN
            logger.info(f"User {user_in.email} is the first user in organization {organization_id}, assigning ADMIN role")
        else:
            # Use role from user_in (will be validated in auth.py endpoint)
            final_role = user_in.role
        
        # Create user with determined role
        # Temporarily override role in user_in for create_user call
        original_role = user_in.role
        user_in.role = final_role
        try:
            user = await crud.create_user(self.db, user_in, hashed, organization_id=organization_id)
        finally:
            # Restore original role (in case it's used elsewhere)
            user_in.role = original_role
        
        return user

    async def update_user(self, user_id: int, user_in: schemas.UserUpdate) -> Optional[User]:
        hashed = get_password_hash(user_in.password) if user_in.password else None
        return await crud.update_user(self.db, user_id, user_in, hashed_password=hashed)
    
    async def delete_user(self, user_id: int) -> bool:
        """Delete a user"""
        return await crud.delete_user(self.db, user_id)

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        user = await self.get_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        # Update last login
        await self.db.execute(
            update(User)
            .where(User.id == user.id)
            .values(last_login=datetime.utcnow())
        )
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update_user_domains(self, user_id: int, domain_ids: List[int]) -> Optional[User]:
        """Update user's domain associations"""
        user = await self.get_by_id(user_id)
        if not user:
            return None
        
        # Remove existing associations
        await self.db.execute(
            delete(user_domains).where(user_domains.c.user_id == user_id)
        )
        
        # Add new associations
        if domain_ids:
            await self.db.execute(
                insert(user_domains).values([
                    {"user_id": user_id, "domain_id": domain_id}
                    for domain_id in domain_ids
                ])
            )
        
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def get_user_domains(self, user_id: int) -> List[Domain]:
        """
        Get user's accessible domains
        
        User domains are now derived from organization domains.
        Users automatically have access to all domains integrated into their organization.
        """
        user = await self.get_by_id(user_id)
        if not user:
            return []
        
        # SUPER_ADMIN has access to all domains
        if user.role == UserRole.SUPER_ADMIN:
            result = await self.db.execute(select(Domain))
            return list(result.scalars().all())
        
        # Get organization's domains
        if user.organization_id:
            from backend.database import crud
            org_domains = await crud.get_organization_domains(self.db, user.organization_id)
            return org_domains
        
        return []

    async def ensure_default_admin(self):
        """Create default admin if none exists"""
        existing = await self.get_by_email("admin@safevision.io")
        if existing:
            return existing
        admin = schemas.UserCreate(
            email="admin@safevision.io",
            full_name="System Admin",
            password="admin123",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
        )
        return await self.create_user(admin)


