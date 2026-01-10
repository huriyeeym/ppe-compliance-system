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

