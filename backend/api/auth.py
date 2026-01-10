"""
Authentication endpoints (login, current user)
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.database.connection import get_db
from backend.database import schemas
from backend.services.user_service import UserService
from backend.utils.security import create_access_token
from backend.database.models import UserRole


router = APIRouter(prefix="/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/login"
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kimlik doğrulama bilgileri geçersiz",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    service = UserService(db)
    user = await service.get_by_id(int(user_id))
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Kullanıcı pasif durumda")
    
    # Load user's domains from organization (not from user_domains table)
    # User domains are now derived from organization domains
    user_domains_list = await service.get_user_domains(user.id)
    # Set domains on user object for backward compatibility
    user.domains = user_domains_list
    
    return user


async def get_current_admin(current_user=Depends(get_current_user)):
    """Require admin or super_admin role"""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için admin yetkisi gereklidir"
        )
    return current_user


async def get_current_super_admin(current_user=Depends(get_current_user)):
    """Require super_admin role only"""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için super admin yetkisi gereklidir"
        )
    return current_user


@router.post("/login", response_model=schemas.TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    service = UserService(db)
    user = await service.authenticate(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )
    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.post("/register", response_model=schemas.TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: schemas.UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Register a new user (self-registration)

    Creates a new user account and returns access token.
    
    Restrictions for self-registration:
    - Only VIEWER or OPERATOR roles allowed (ADMIN/MANAGER/SUPER_ADMIN must be assigned by admin)
    - domain_ids parameter not allowed (admin will assign domains later)
    - First user in organization automatically gets ADMIN role
    """
    service = UserService(db)

    # Check if user already exists
    existing_user = await service.get_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Determine target organization to check if this is first user
    from backend.database import crud as org_crud
    organization_id = None
    
    # Try to find organization by email domain
    org = await org_crud.get_organization_by_email_domain(db, user_data.email)
    if org:
        organization_id = org.id
    # Or by organization_name if provided
    elif hasattr(user_data, 'organization_name') and user_data.organization_name:
        org = await org_crud.get_or_create_organization_by_name(db, user_data.organization_name)
        organization_id = org.id
    
    # Default to organization 1 if still None
    if organization_id is None:
        organization_id = 1
    
    # Check if this is the first user in the organization
    user_count = await org_crud.get_organization_user_count(db, organization_id)
    is_first_user = user_count == 0
    
    # Validate role for self-registration
    if not is_first_user:
        # For non-first users, only VIEWER or OPERATOR allowed
        if user_data.role not in [UserRole.VIEWER, UserRole.OPERATOR]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Self-registration only allows VIEWER or OPERATOR roles. {user_data.role.value} role must be assigned by an admin."
            )
    
    # Validate domain_ids - self-registration should not include domain_ids
    # Admin will assign domains later
    if hasattr(user_data, 'domain_ids') and user_data.domain_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain selection is not allowed during self-registration. Admin will assign domains after registration."
        )

    # Create new user (first user will automatically get ADMIN role in user_service)
    user = await service.create_user(user_data)

    # Generate access token
    access_token = create_access_token(
        subject=user.id,
        role=user.role.value,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )

    return schemas.TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.post("/select-domains", status_code=status.HTTP_200_OK)
async def select_domains(
    domain_selection: schemas.UserDomainSelection,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add domains to organization (deprecated: use /organizations/{org_id}/domains/{domain_id} instead)
    
    This endpoint adds domains to the user's organization.
    Users no longer select domains individually - organization admin manages organization domains.
    """
    from backend.database import crud
    from backend.database.models import UserRole
    
    # Only ADMIN and SUPER_ADMIN can add domains to organization
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can add domains to the organization"
        )
    
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with an organization"
        )
    
    # Validate domain IDs exist and add to organization
    added_domains = []
    for domain_id in domain_selection.domain_ids:
        domain = await crud.get_domain_by_id(db, domain_id)
        if not domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Domain {domain_id} not found"
            )
        
        # Add domain to organization
        success = await crud.add_domain_to_organization(
            db, 
            current_user.organization_id, 
            domain_id,
            created_by=current_user.id
        )
        if success:
            added_domains.append({"id": domain.id, "name": domain.name, "type": domain.type})
    
    return {
        "message": "Domains added to organization successfully", 
        "domains": added_domains
    }


@router.get("/me", response_model=schemas.UserResponse)
async def read_me(current_user=Depends(get_current_user)):
    return current_user

