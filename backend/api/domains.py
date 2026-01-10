"""
Domain API endpoints
Manage work domains (construction, manufacturing, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from backend.database.connection import get_db
from backend.database import crud, schemas
from backend.services.domain_service import DomainService
from backend.services.ppe_type_service import PPETypeService
from backend.utils.logger import logger
from backend.utils.permissions import has_permission, Permission
from backend.api.auth import get_current_user
from backend.database.models import UserRole


router = APIRouter(prefix="/domains", tags=["Domains"])


@router.get("", response_model=List[schemas.DomainResponse])
async def get_domains(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all domains with pagination
    
    - **skip**: Number of records to skip (default: 0)
    - **limit**: Maximum number of records to return (default: 100)
    """
    service = DomainService(db)
    domains = await service.get_all(skip=skip, limit=limit)
    return domains


@router.get("/{domain_id}", response_model=schemas.DomainResponse)
async def get_domain(
    domain_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific domain by ID
    """
    service = DomainService(db)
    domain = await service.get_by_id(domain_id)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {domain_id} not found"
        )
    return domain


@router.post("", response_model=schemas.DomainResponse, status_code=status.HTTP_201_CREATED)
async def create_domain(
    domain: schemas.DomainCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Create a new domain
    
    - **name**: Display name (e.g., "İnşaat Alanı")
    - **type**: Type identifier (e.g., "construction")
    - **icon**: Optional emoji icon
    - **description**: Optional description
    - **status**: Domain status (active/planned)
    
    **Permissions:**
    - Only ADMIN and SUPER_ADMIN can create domains
    """
    if not has_permission(current_user, Permission.DOMAINS_CREATE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create domains"
        )
    service = DomainService(db)
    try:
        return await service.create(domain)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{domain_id}", response_model=schemas.DomainResponse)
async def update_domain(
    domain_id: int,
    domain: schemas.DomainUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Update a domain
    
    All fields are optional. Only provided fields will be updated.
    
    **Permissions:**
    - Only SUPER_ADMIN can update domains (status, name, description)
    - ADMIN cannot update domains (they are system-level)
    """
    # Only SUPER_ADMIN can update domains
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN can update domains. Domains are system-level and cannot be modified by organization admins."
        )
    service = DomainService(db)
    updated_domain = await service.update(domain_id, domain)
    if not updated_domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {domain_id} not found"
        )
    return updated_domain


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Delete a domain
    
    **Warning:** Domains are system-level and should not be deleted.
    This endpoint is disabled for all users including SUPER_ADMIN.
    Domains are defined in seed data and represent trained models.
    
    **Permissions:**
    - Disabled for all users (domains are system-level, cannot be deleted)
    """
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Domains cannot be deleted. They are system-level entities defined in seed data. To remove a domain from your organization, use the organization domain management endpoints."
    )
    service = DomainService(db)
    success = await service.delete(domain_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {domain_id} not found"
        )
    return None


@router.get("/{domain_id}/rules", response_model=List[schemas.DomainPPERuleResponse])
async def get_domain_rules(
    domain_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all PPE rules for a specific domain
    
    Returns the list of required/optional PPE items for this domain
    """
    service = DomainService(db)
    domain = await service.get_by_id(domain_id)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {domain_id} not found"
        )
    
    rules = await service.get_rules(domain_id)
    return rules


@router.post("/{domain_id}/rules", response_model=schemas.DomainPPERuleResponse, status_code=status.HTTP_201_CREATED)
async def create_domain_rule(
    domain_id: int,
    rule: schemas.DomainPPERuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new PPE rule for a domain
    
    **Note:** The rule's domain_id must match the path parameter
    """
    if rule.domain_id != domain_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rule domain_id must match path parameter"
        )
    
    # Check if domain exists
    service = DomainService(db)
    domain = await service.get_by_id(domain_id)
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with id {domain_id} not found"
        )
    
    # Check if PPE type exists
    ppe_type_service = PPETypeService(db)
    ppe_type = await ppe_type_service.get_by_id(rule.ppe_type_id)
    if not ppe_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PPE type with id {rule.ppe_type_id} not found"
        )
    
    return await crud.create_domain_rule(db, rule)

