"""
User management endpoints with permission-based access control
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from backend.database.models import User

from backend.database.connection import get_db
from backend.database import schemas
from backend.services.user_service import UserService
from backend.utils.auth_decorators import require_permission, require_role
from backend.utils.permissions import Permission
from backend.database.models import UserRole
from backend.api.auth import get_current_user


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me/domains", response_model=List[schemas.DomainResponse])
async def get_my_domains(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user's accessible domains
    """
    service = UserService(db)
    domains = await service.get_user_domains(current_user.id)
    return domains


@router.get("", response_model=List[schemas.UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_VIEW))
):
    """
    List all users (filtered by domain if user is domain_admin)
    """
    service = UserService(db)
    users = await service.list_users(skip=skip, limit=limit)
    
    # Filter by domain if user is not SUPER_ADMIN
    if current_user.role != UserRole.SUPER_ADMIN and current_user.domain_id:
        users = [u for u in users if u.domain_id == current_user.domain_id or u.role == UserRole.SUPER_ADMIN]
    
    return users


@router.post("", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_CREATE))
):
    """
    Create a new user
    Domain admins can only create users for their domain
    """
    service = UserService(db)
    existing = await service.get_by_email(user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta zaten kayıtlı"
        )
    
    # Domain admins can only assign users to their domain
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.domain_id:
            user_in.domain_id = current_user.domain_id
        # Domain admins cannot create SUPER_ADMIN users
        if user_in.role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN rolü oluşturulamaz"
            )
    
    return await service.create_user(user_in)


@router.get("/{user_id}", response_model=schemas.UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_VIEW))
):
    """Get user by ID"""
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Domain admins can only view users in their domain
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.domain_id and user.domain_id != current_user.domain_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcıya erişim yetkiniz yok"
            )
    
    return user


@router.put("/{user_id}", response_model=schemas.UserResponse)
async def update_user(
    user_id: int,
    user_in: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_UPDATE))
):
    """Update user"""
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Domain admins can only update users in their domain
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.domain_id and user.domain_id != current_user.domain_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcıyı güncelleme yetkiniz yok"
            )
        # Domain admins cannot change role to SUPER_ADMIN
        if user_in.role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN rolü atanamaz"
            )
    
    return await service.update_user(user_id, user_in)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_DELETE))
):
    """Delete user (only SUPER_ADMIN)"""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı silme yetkisi sadece SUPER_ADMIN'e aittir"
        )
    
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi hesabınızı silemezsiniz"
        )
    
    await service.delete_user(user_id)
    return None

