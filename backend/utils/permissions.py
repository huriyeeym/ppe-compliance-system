"""
Permission system for role-based and permission-based access control
"""

from enum import Enum
from typing import List, Optional
from backend.database.models import User, UserRole


class Permission(str, Enum):
    """System permissions"""
    # Violations
    VIOLATIONS_VIEW = "violations:view"
    VIOLATIONS_ACKNOWLEDGE = "violations:acknowledge"
    VIOLATIONS_DELETE = "violations:delete"
    VIOLATIONS_EXPORT = "violations:export"
    
    # Cameras
    CAMERAS_VIEW = "cameras:view"
    CAMERAS_CREATE = "cameras:create"
    CAMERAS_UPDATE = "cameras:update"
    CAMERAS_DELETE = "cameras:delete"
    
    # Domains
    DOMAINS_VIEW = "domains:view"
    DOMAINS_CREATE = "domains:create"
    DOMAINS_UPDATE = "domains:update"
    DOMAINS_DELETE = "domains:delete"
    
    # Users
    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_UPDATE = "users:update"
    USERS_DELETE = "users:delete"
    
    # Reports
    REPORTS_VIEW = "reports:view"
    REPORTS_EXPORT = "reports:export"
    
    # Analytics
    ANALYTICS_VIEW = "analytics:view"
    ANALYTICS_EXPORT = "analytics:export"
    
    # Configuration
    CONFIG_VIEW = "config:view"
    CONFIG_UPDATE = "config:update"
    
    # Violations - additional granular permissions
    VIOLATIONS_UPDATE_STATUS = "violations:update_status"  # Full status update (closed/false_positive)
    VIOLATIONS_UPDATE_NOTES = "violations:update_notes"  # Update notes/corrective actions
    
    # System
    SYSTEM_ADMIN = "system:admin"


# Role-based default permissions
ROLE_PERMISSIONS: dict[UserRole, List[Permission]] = {
    UserRole.SUPER_ADMIN: [
        # All permissions
        Permission.VIOLATIONS_VIEW,
        Permission.VIOLATIONS_ACKNOWLEDGE,
        Permission.VIOLATIONS_UPDATE_STATUS,
        Permission.VIOLATIONS_UPDATE_NOTES,
        Permission.VIOLATIONS_DELETE,
        Permission.VIOLATIONS_EXPORT,
        Permission.CAMERAS_VIEW,
        Permission.CAMERAS_CREATE,
        Permission.CAMERAS_UPDATE,
        Permission.CAMERAS_DELETE,
        Permission.DOMAINS_VIEW,
        Permission.DOMAINS_CREATE,
        Permission.DOMAINS_UPDATE,
        Permission.DOMAINS_DELETE,
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,
        Permission.USERS_DELETE,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.CONFIG_VIEW,
        Permission.CONFIG_UPDATE,
        Permission.SYSTEM_ADMIN,
    ],
    UserRole.ADMIN: [
        # Full access to assigned domains
        Permission.VIOLATIONS_VIEW,
        Permission.VIOLATIONS_ACKNOWLEDGE,
        Permission.VIOLATIONS_UPDATE_STATUS,
        Permission.VIOLATIONS_UPDATE_NOTES,
        Permission.VIOLATIONS_EXPORT,
        Permission.CAMERAS_VIEW,
        Permission.CAMERAS_CREATE,
        Permission.CAMERAS_UPDATE,
        Permission.CAMERAS_DELETE,
        Permission.DOMAINS_VIEW,
        Permission.DOMAINS_CREATE,
        Permission.DOMAINS_UPDATE,
        Permission.DOMAINS_DELETE,
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.CONFIG_VIEW,
        Permission.CONFIG_UPDATE,
    ],
    UserRole.MANAGER: [
        # Manage violations and view analytics
        Permission.VIOLATIONS_VIEW,
        Permission.VIOLATIONS_ACKNOWLEDGE,
        Permission.VIOLATIONS_UPDATE_STATUS,
        Permission.VIOLATIONS_UPDATE_NOTES,
        Permission.VIOLATIONS_EXPORT,
        Permission.CAMERAS_VIEW,
        Permission.DOMAINS_VIEW,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.CONFIG_VIEW,  # View-only access to configure
    ],
    UserRole.OPERATOR: [
        # Acknowledge violations, view live camera
        Permission.VIOLATIONS_VIEW,
        Permission.VIOLATIONS_ACKNOWLEDGE,
        Permission.CAMERAS_VIEW,
        Permission.DOMAINS_VIEW,
        Permission.REPORTS_VIEW,
    ],
    UserRole.VIEWER: [
        # Read-only access
        Permission.VIOLATIONS_VIEW,
        Permission.CAMERAS_VIEW,
        Permission.DOMAINS_VIEW,
        Permission.REPORTS_VIEW,
    ],
}


def get_user_permissions(user: User) -> List[Permission]:
    """
    Get all permissions for a user (role-based + custom permissions)
    
    Args:
        user: User object
        
    Returns:
        List of Permission enums
    """
    permissions = set()
    
    # Add role-based permissions
    role_perms = ROLE_PERMISSIONS.get(user.role, [])
    permissions.update(role_perms)
    
    # Add custom permissions from user.permissions
    if user.permissions:
        for perm_str in user.permissions:
            try:
                perm = Permission(perm_str)
                permissions.add(perm)
            except ValueError:
                # Invalid permission string, skip
                pass
    
    return list(permissions)


def has_permission(user: User, permission: Permission) -> bool:
    """
    Check if user has a specific permission
    
    Args:
        user: User object
        permission: Permission to check
        
    Returns:
        True if user has permission, False otherwise
    """
    # SUPER_ADMIN has all permissions
    if user.role == UserRole.SUPER_ADMIN:
        return True
    
    user_permissions = get_user_permissions(user)
    return permission in user_permissions


def has_any_permission(user: User, permissions: List[Permission]) -> bool:
    """
    Check if user has any of the specified permissions
    
    Args:
        user: User object
        permissions: List of permissions to check
        
    Returns:
        True if user has at least one permission, False otherwise
    """
    return any(has_permission(user, perm) for perm in permissions)


def can_access_domain(user: User, domain_id: int) -> bool:
    """
    Check if user can access a specific domain
    
    Args:
        user: User object
        domain_id: Domain ID to check
        
    Returns:
        True if user can access domain, False otherwise
    """
    # SUPER_ADMIN can access all domains
    if user.role == UserRole.SUPER_ADMIN:
        return True
    
    # If user has domain_id set, they can only access that domain
    if user.domain_id is not None:
        return user.domain_id == domain_id
    
    # ADMIN without domain_id can access all domains (legacy support)
    if user.role == UserRole.ADMIN:
        return True
    
    # Other roles need explicit domain_id
    return False

