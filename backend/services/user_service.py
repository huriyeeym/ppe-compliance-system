"""
User service for authentication and admin management
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from datetime import datetime

from backend.database import crud, schemas
from backend.database.models import User, UserRole
from backend.utils.security import verify_password, get_password_hash


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
        hashed = get_password_hash(user_in.password)
        return await crud.create_user(self.db, user_in, hashed)

    async def update_user(self, user_id: int, user_in: schemas.UserUpdate) -> Optional[User]:
        hashed = get_password_hash(user_in.password) if user_in.password else None
        return await crud.update_user(self.db, user_id, user_in, hashed_password=hashed)

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


