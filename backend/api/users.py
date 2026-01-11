"""
User management endpoints with permission-based access control
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict
from backend.database.models import User, Domain

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


@router.get("", response_model=schemas.PaginatedResponse[schemas.UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organization_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_VIEW))
):
    """
    List users with organization-based filtering
    
    **Permissions:**
    - SUPER_ADMIN: Can view all users (optional: filter by organization_id query param)
    - ADMIN: Can only view users in their own organization
    - Other roles: Cannot access this endpoint
    """
    from backend.utils.logger import logger
    
    try:
        service = UserService(db)
        
        # Debug logging
        logger.info(f"list_users called by user {current_user.id} (role: {current_user.role}, org_id: {current_user.organization_id})")
        
        # Determine organization_id for filtering
        filter_organization_id = None
        
        if current_user.role == UserRole.SUPER_ADMIN:
            # SUPER_ADMIN can view all users or filter by organization_id
            filter_organization_id = organization_id
            logger.info(f"SUPER_ADMIN: filter_organization_id = {filter_organization_id}")
        else:
            # ADMIN and others can only view their own organization's users
            if current_user.organization_id:
                filter_organization_id = current_user.organization_id
                logger.info(f"ADMIN: filter_organization_id = {filter_organization_id}")
            else:
                # User has no organization, return empty list
                logger.warning(f"User {current_user.id} has no organization_id, returning empty list")
                return []
        
        users, total = await service.list_users(skip=skip, limit=limit, organization_id=filter_organization_id)
        logger.info(f"Found {len(users)} users (total: {total}) for organization_id={filter_organization_id}")
        
        # Load domains for each user from their organization
        # Group by organization_id to minimize queries
        org_ids = list(set(user.organization_id for user in users if user.organization_id))
        domains_by_org: Dict[int, List[Domain]] = {}
        
        if org_ids:
            # Load all organization domains in batch using direct SQL query
            # This avoids async context issues
            from backend.database.models import organization_domains
            from sqlalchemy import select
            
            # First, get all organization-domain mappings
            org_domain_mappings_query = select(
                organization_domains.c.organization_id,
                organization_domains.c.domain_id
            ).where(organization_domains.c.organization_id.in_(org_ids))
            
            mappings_result = await db.execute(org_domain_mappings_query)
            mappings = mappings_result.all()
            
            # Get unique domain IDs
            domain_ids = list(set(mapping.domain_id for mapping in mappings))
            
            if domain_ids:
                # Load all domains in one query
                domains_query = select(Domain).where(Domain.id.in_(domain_ids))
                
                domains_result = await db.execute(domains_query)
                all_domains = domains_result.scalars().all()
                
                # Create domain lookup by ID
                domain_by_id = {domain.id: domain for domain in all_domains}
                
                # Map domains to organizations
                for org_id in org_ids:
                    domains_by_org[org_id] = []
                
                for mapping in mappings:
                    org_id = mapping.organization_id
                    domain_id = mapping.domain_id
                    if domain_id in domain_by_id:
                        domain = domain_by_id[domain_id]
                        if domain not in domains_by_org[org_id]:
                            domains_by_org[org_id].append(domain)
        
        # Build response manually to avoid async context issues with relationships
        from backend.database import schemas as db_schemas
        response_users = []
        for idx, user in enumerate(users):
            user_domains = []
            # Special handling for System Admin (user_id=1 or email=admin@safevision.io)
            # System Admin should always show organization domains, not user_domains table entries
            is_system_admin = user.id == 1 or user.email == "admin@safevision.io"
            
            # #region agent log
            import json
            with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps({
                    'sessionId': 'debug-session',
                    'runId': 'run1',
                    'hypothesisId': 'F',
                    'location': 'backend/api/users.py:127',
                    'message': 'User domains check',
                    'data': {
                        'userId': user.id,
                        'userEmail': user.email,
                        'isSystemAdmin': is_system_admin,
                        'hasDomainsAttr': hasattr(user, 'domains'),
                        'domainsCount': len(user.domains) if hasattr(user, 'domains') and user.domains else 0,
                        'domainsIds': [d.id for d in user.domains] if hasattr(user, 'domains') and user.domains else [],
                        'organizationId': user.organization_id
                    },
                    'timestamp': int(__import__('time').time() * 1000)
                }) + '\n')
            # #endregion
            
            if is_system_admin and user.organization_id:
                # For System Admin, use organization domains instead of user_domains table
                org_domains = domains_by_org.get(user.organization_id, [])
                for domain in org_domains:
                    user_domains.append(db_schemas.DomainResponse(
                        id=domain.id,
                        name=domain.name,
                        type=domain.type,
                        description=domain.description,
                        status=domain.status,
                        created_at=domain.created_at,
                        model_status=getattr(domain, 'model_status', 'not_loaded'),
                        model_last_updated=getattr(domain, 'model_last_updated', None)
                    ))
                # #region agent log
                with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
                    f.write(json.dumps({
                        'sessionId': 'debug-session',
                        'runId': 'run1',
                        'hypothesisId': 'F',
                        'location': 'backend/api/users.py:155',
                        'message': 'System Admin using org domains',
                        'data': {
                            'userId': user.id,
                            'orgDomainsCount': len(org_domains),
                            'orgDomainsIds': [d.id for d in org_domains]
                        },
                        'timestamp': int(__import__('time').time() * 1000)
                    }) + '\n')
                # #endregion
            elif user.domains:
                # For other users, use user's actual domains (from user_domains table)
                for domain in user.domains:
                    user_domains.append(db_schemas.DomainResponse(
                        id=domain.id,
                        name=domain.name,
                        type=domain.type,
                        description=domain.description,
                        status=domain.status,
                        created_at=domain.created_at,
                        model_status=getattr(domain, 'model_status', 'not_loaded'),
                        model_last_updated=getattr(domain, 'model_last_updated', None)
                    ))
            # #region agent log
            with open(r'c:\Users\90545\Desktop\MASAUSTU\Projects\PPE\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps({
                    'sessionId': 'debug-session',
                    'runId': 'run1',
                    'hypothesisId': 'E',
                    'location': 'backend/api/users.py:165',
                    'message': 'User response domains final',
                    'data': {
                        'userId': user.id,
                        'userEmail': user.email,
                        'userDomainsCount': len(user_domains),
                        'userDomainsIds': [d.id for d in user_domains],
                        'organizationId': user.organization_id,
                        'orgDomainsCount': len(domains_by_org.get(user.organization_id, [])) if user.organization_id else 0
                    },
                    'timestamp': int(__import__('time').time() * 1000)
                }) + '\n')
            # #endregion
            
            user_response = db_schemas.UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                organization_id=user.organization_id,
                is_active=user.is_active,
                created_at=user.created_at,
                last_login=user.last_login,
                domains=user_domains
            )
            response_users.append(user_response)
        
        return schemas.PaginatedResponse(
            items=response_users,
            total=total,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Error in list_users endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kullanıcılar yüklenirken hata oluştu: {str(e)}"
        )


@router.post("", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_CREATE))
):
    """
    Create a new user with organization assignment
    
    **Organization Assignment:**
    - ADMIN: New user is automatically assigned to admin's organization
    - SUPER_ADMIN: Can specify organization_name in request (optional)
    
    **Role Restrictions:**
    - ADMIN cannot create SUPER_ADMIN users
    - ADMIN cannot create other ADMIN users (only first user is admin)
    """
    service = UserService(db)
    existing = await service.get_by_email(user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu e-posta zaten kayıtlı"
        )
    
    # Organization assignment logic
    if current_user.role == UserRole.SUPER_ADMIN:
        # SUPER_ADMIN can specify organization_name, or it will be determined from email domain
        pass  # UserService will handle organization assignment
    else:
        # ADMIN: Force assignment to admin's organization
        # Override organization_name if provided, use current user's organization
        if current_user.organization_id:
            # Set organization_name to current user's organization name
            # This will be used by UserService to assign the new user to the same organization
            from backend.database import crud
            org = await crud.get_organization_by_id(db, current_user.organization_id)
            if org:
                user_in.organization_name = org.name
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You must be associated with an organization to create users"
            )
    
    # Role restrictions
    if current_user.role != UserRole.SUPER_ADMIN:
        # ADMIN cannot create SUPER_ADMIN users
        if user_in.role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN rolü oluşturulamaz"
            )
        # ADMIN cannot create other ADMIN users (only first user in organization is admin)
        if user_in.role == UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ADMIN rolü oluşturulamaz. Sadece organization'ın ilk kullanıcısı ADMIN olabilir."
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
    
    # Organization-based access control
    if current_user.role != UserRole.SUPER_ADMIN:
        # ADMIN can only view users in their own organization
        if current_user.organization_id != user.organization_id:
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
    
    # Organization-based access control
    if current_user.role != UserRole.SUPER_ADMIN:
        # ADMIN can only update users in their own organization
        if current_user.organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcıyı güncelleme yetkiniz yok"
            )
        # ADMIN cannot change role to SUPER_ADMIN
        if user_in.role == UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SUPER_ADMIN rolü atanamaz"
            )
        # ADMIN cannot change role to ADMIN (only first user in organization is admin)
        if user_in.role == UserRole.ADMIN and user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ADMIN rolü atanamaz. Sadece organization'ın ilk kullanıcısı ADMIN olabilir."
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# USER PHOTO ENDPOINTS
# ==========================================

@router.post("/{user_id}/photos", response_model=schemas.UserPhotoResponse, status_code=status.HTTP_201_CREATED)
async def upload_user_photo(
    user_id: int,
    file: UploadFile = File(...),
    is_primary: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_UPDATE))
):
    """
    Upload a photo for a user and extract face encoding
    
    **Permissions:**
    - ADMIN: Can upload photos for users in their organization
    - SUPER_ADMIN: Can upload photos for any user
    """
    from pathlib import Path
    from backend.database import crud
    from backend.config import settings
    from backend.utils.logger import logger
    import shutil
    import uuid
    
    # Try to import FaceRecognitionService - make it optional
    try:
        from backend.services.face_recognition_service import FaceRecognitionService
        FACE_RECOGNITION_AVAILABLE = True
    except ImportError as e:
        logger.warning(f"Face recognition service not available: {e}. Photo upload will continue without face encoding.")
        FACE_RECOGNITION_AVAILABLE = False
        FaceRecognitionService = None
    except Exception as e:
        logger.warning(f"Face recognition service not available: {e}. Photo upload will continue without face encoding.")
        FACE_RECOGNITION_AVAILABLE = False
        FaceRecognitionService = None
    
    # Verify user exists and access control
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Organization-based access control
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcı için fotoğraf yükleme yetkiniz yok"
            )
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sadece resim dosyaları yüklenebilir"
        )
    
    # Create user photos directory
    user_photos_dir = settings.user_photos_dir / str(user_id)
    user_photos_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix if file.filename else '.jpg'
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    photo_path = user_photos_dir / unique_filename
    
    # Save file
    try:
        with open(photo_path, 'wb') as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Error saving photo file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fotoğraf kaydedilemedi"
        )
    
    # Extract face encoding (optional - only if face recognition is available)
    face_encoding = None
    
    if FACE_RECOGNITION_AVAILABLE:
        try:
            face_service = FaceRecognitionService()
            face_encoding = face_service.extract_face_encoding(str(photo_path))
            if face_encoding is None:
                logger.warning(f"No face detected in uploaded photo for user {user_id}")
        except Exception as e:
            logger.error(f"Error extracting face encoding: {str(e)}")
            # Continue without encoding - admin can retry later
    else:
        logger.info("Face recognition not available - photo uploaded without face encoding")
    
    # Save relative path (from data directory)
    relative_path = f"user_photos/{user_id}/{unique_filename}"
    
    # Create database record
    try:
        photo = await crud.create_user_photo(
            db=db,
            user_id=user_id,
            photo_path=relative_path,
            face_encoding=face_encoding,
            is_primary=is_primary,
            uploaded_by=current_user.id
        )
        return photo
    except Exception as e:
        # Clean up file if database save fails
        if photo_path.exists():
            photo_path.unlink()
        logger.error(f"Error creating photo record: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fotoğraf kaydı oluşturulamadı"
        )


@router.get("/{user_id}/photos", response_model=List[schemas.UserPhotoResponse])
async def list_user_photos(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_VIEW))
):
    """
    List all photos for a user
    
    **Permissions:**
    - ADMIN: Can view photos for users in their organization
    - SUPER_ADMIN: Can view photos for any user
    """
    from backend.database import crud
    
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Organization-based access control
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcının fotoğraflarını görüntüleme yetkiniz yok"
            )
    
    photos = await crud.get_user_photos(db, user_id)
    return photos


@router.delete("/{user_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_photo_endpoint(
    user_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_UPDATE))
):
    """
    Delete a user photo
    
    **Permissions:**
    - ADMIN: Can delete photos for users in their organization
    - SUPER_ADMIN: Can delete photos for any user
    """
    from pathlib import Path
    from backend.database import crud
    from backend.config import settings
    from backend.utils.logger import logger
    
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Organization-based access control
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcının fotoğraflarını silme yetkiniz yok"
            )
    
    # Get photo to get file path
    photo = await crud.get_user_photo_by_id(db, photo_id)
    if not photo or photo.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fotoğraf bulunamadı")
    
    # Delete file
    photo_file_path = settings.data_dir / photo.photo_path
    if photo_file_path.exists():
        try:
            photo_file_path.unlink()
        except Exception as e:
            logger.warning(f"Error deleting photo file: {str(e)}")
    
    # Delete database record
    await crud.delete_user_photo(db, photo_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{user_id}/photos/{photo_id}/set-primary", response_model=schemas.UserPhotoResponse)
async def set_primary_photo(
    user_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.USERS_UPDATE))
):
    """
    Set a photo as primary for a user
    
    **Permissions:**
    - ADMIN: Can set primary photo for users in their organization
    - SUPER_ADMIN: Can set primary photo for any user
    """
    from backend.database import crud
    
    service = UserService(db)
    user = await service.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    
    # Organization-based access control
    if current_user.role != UserRole.SUPER_ADMIN:
        if current_user.organization_id != user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu kullanıcı için fotoğraf ayarlama yetkiniz yok"
            )
    
    photo = await crud.update_user_photo(db, photo_id, is_primary=True)
    if not photo or photo.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fotoğraf bulunamadı")
    
    return photo

