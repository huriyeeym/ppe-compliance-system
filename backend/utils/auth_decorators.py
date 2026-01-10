"""
Authentication and authorization decorators for FastAPI endpoints
"""

from functools import wraps
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from backend.database.models import User, UserRole
from backend.utils.permissions import Permission, has_permission, can_access_domain, has_any_permission
from backend.api.auth import get_current_user


def require_permission(permission: Permission):
    """
    Dependency to require a specific permission
    
    Usage:
        @router.get("/violations")
        async def get_violations(
            user: User = Depends(require_permission(Permission.VIOLATIONS_VIEW))
        ):
            ...
    """
    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için '{permission.value}' yetkisi gereklidir"
            )
        return current_user
    return permission_checker


def require_any_permission(permissions: List[Permission]):
    """
    Dependency to require any of the specified permissions
    
    Usage:
        @router.post("/violations")
        async def create_violation(
            user: User = Depends(require_any_permission([
                Permission.VIOLATIONS_CREATE,
                Permission.SYSTEM_ADMIN
            ]))
        ):
            ...
    """
    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        if not has_any_permission(current_user, permissions):
            perm_names = [p.value for p in permissions]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için şu yetkilerden biri gereklidir: {', '.join(perm_names)}"
            )
        return current_user
    return permission_checker


def require_role(*allowed_roles: UserRole):
    """
    Dependency to require specific role(s)
    
    Usage:
        @router.delete("/users/{user_id}")
        async def delete_user(
            user: User = Depends(require_role(UserRole.SUPER_ADMIN, UserRole.ADMIN))
        ):
            ...
    """
    allowed_roles_set = set(allowed_roles)
    
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles_set:
            role_names = [r.value for r in allowed_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için şu rollerden biri gereklidir: {', '.join(role_names)}"
            )
        return current_user
    return role_checker


def require_domain_access(domain_id_param: str = "domain_id"):
    """
    Dependency to require domain access
    
    Checks if user can access the domain specified in the route parameter
    
    Usage:
        @router.get("/domains/{domain_id}/violations")
        async def get_domain_violations(
            domain_id: int,
            user: User = Depends(require_domain_access("domain_id"))
        ):
            ...
    """
    def domain_checker(
        current_user: User = Depends(get_current_user),
        **kwargs
    ) -> User:
        domain_id = kwargs.get(domain_id_param)
        if domain_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Domain ID parametresi bulunamadı: {domain_id_param}"
            )
        
        if not can_access_domain(current_user, domain_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu domain'e erişim yetkiniz yok (domain_id: {domain_id})"
            )
        return current_user
    return domain_checker


def get_optional_user(
    current_user: Optional[User] = Depends(get_current_user)
) -> Optional[User]:
    """
    Optional user dependency (doesn't fail if no auth)
    Useful for public endpoints that have optional user features
    """
    return current_user

