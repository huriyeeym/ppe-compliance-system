"""
Organization domain management API endpoints
Manage which domains are integrated into each organization
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.database.connection import get_db
from backend.database import crud, schemas
from backend.utils.logger import logger
from backend.api.auth import get_current_user
from backend.database.models import UserRole, Domain


router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post("/{organization_id}/domains/migrate", status_code=status.HTTP_200_OK)
async def migrate_user_domains_to_organization(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Migrate existing user_domains to organization_domains
    
    This endpoint collects all domains selected by users in the organization
    and adds them to organization_domains. Useful for migrating from old system.
    
    **Permissions:**
    - Only ADMIN and SUPER_ADMIN can run migration
    """
    from backend.database.models import user_domains
    from sqlalchemy import select, and_
    
    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can run migration"
        )
    
    # Check if user has access to this organization
    if current_user.role != UserRole.SUPER_ADMIN and current_user.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only migrate domains for your own organization"
        )
    
    # Verify organization exists
    org = await crud.get_organization_by_id(db, organization_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Get all users in this organization
    from backend.database.models import User
    users_result = await db.execute(
        select(User).where(User.organization_id == organization_id)
    )
    users = users_result.scalars().all()
    
    if not users:
        return {"message": "No users found in organization", "domains_added": 0}
    
    # Collect all domain IDs selected by users
    domain_ids = set()
    for user in users:
        user_domains_result = await db.execute(
            select(user_domains.c.domain_id)
            .where(user_domains.c.user_id == user.id)
        )
        user_domain_ids = [row[0] for row in user_domains_result.all()]
        domain_ids.update(user_domain_ids)
    
    # Add each domain to organization_domains
    added_count = 0
    for domain_id in domain_ids:
        # Check if already exists
        if await crud.has_organization_domain(db, organization_id, domain_id):
            continue
        
        # Verify domain exists
        domain = await crud.get_domain_by_id(db, domain_id)
        if not domain:
            continue
        
        # Add to organization
        success = await crud.add_domain_to_organization(
            db, 
            organization_id, 
            domain_id,
            created_by=current_user.id
        )
        if success:
            added_count += 1
    
    logger.info(f"Migration completed for organization {organization_id}: {added_count} domains added")
    return {
        "message": f"Migration completed. {added_count} domains added to organization.",
        "domains_added": added_count
    }


@router.get("/{organization_id}/domains", response_model=List[schemas.DomainResponse])
async def get_organization_domains(
    organization_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get all domains for an organization
    
    **Permissions:**
    - Any authenticated user in the organization can view domains
    - SUPER_ADMIN can view any organization's domains
    """
    # Check if user has access to this organization
    if current_user.role != UserRole.SUPER_ADMIN and current_user.organization_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view domains for your own organization"
        )
    
    domains = await crud.get_organization_domains(db, organization_id)
    return domains


@router.post("/{organization_id}/domains/{domain_id}", status_code=status.HTTP_201_CREATED)
async def add_domain_to_organization(
    organization_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Add a domain to an organization
    
    **Permissions:**
    - ADMIN can add domains to their own organization
    - SUPER_ADMIN can add domains to any organization
    """
    # Check permissions
    if current_user.role == UserRole.SUPER_ADMIN:
        # SUPER_ADMIN can add to any organization
        pass
    elif current_user.role == UserRole.ADMIN and current_user.organization_id == organization_id:
        # ADMIN can add to their own organization
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to add domains to this organization"
        )
    
    # Verify organization exists
    org = await crud.get_organization_by_id(db, organization_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Verify domain exists
    domain = await crud.get_domain_by_id(db, domain_id)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {domain_id} not found"
        )
    
    # Add domain to organization
    success = await crud.add_domain_to_organization(
        db, 
        organization_id, 
        domain_id, 
        created_by=current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Domain {domain_id} is already added to organization {organization_id}"
        )
    
    logger.info(f"Domain {domain_id} added to organization {organization_id} by user {current_user.id}")
    return {"message": "Domain added to organization successfully"}


@router.delete("/{organization_id}/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_domain_from_organization(
    organization_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Remove a domain from an organization
    
    **Warning:** This will affect all cameras and violations associated with this domain in the organization.
    
    **Permissions:**
    - ADMIN can remove domains from their own organization
    - SUPER_ADMIN can remove domains from any organization
    """
    # Check permissions
    if current_user.role == UserRole.SUPER_ADMIN:
        # SUPER_ADMIN can remove from any organization
        pass
    elif current_user.role == UserRole.ADMIN and current_user.organization_id == organization_id:
        # ADMIN can remove from their own organization
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to remove domains from this organization"
        )
    
    # Verify organization exists
    org = await crud.get_organization_by_id(db, organization_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with id {organization_id} not found"
        )
    
    # Check if domain has cameras in this organization
    cameras = await crud.get_cameras_by_domain(db, domain_id, organization_id=organization_id)
    if cameras:
        logger.warning(
            f"Removing domain {domain_id} from organization {organization_id} "
            f"which has {len(cameras)} cameras. This may affect existing violations."
        )
    
    # Remove domain from organization
    success = await crud.remove_domain_from_organization(db, organization_id, domain_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain {domain_id} is not associated with organization {organization_id}"
        )
    
    logger.info(f"Domain {domain_id} removed from organization {organization_id} by user {current_user.id}")
    return None

