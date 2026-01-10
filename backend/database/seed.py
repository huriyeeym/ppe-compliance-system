"""
Database seeding functions
Populates database with initial data from seed_data.py
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.database.models import Domain, PPEType, DomainPPERule, DomainStatus, Organization
from backend.database import seed_data, crud
from backend.database.schemas import DomainCreate, PPETypeCreate, DomainPPERuleCreate
from backend.utils.logger import logger


async def seed_domains(db: AsyncSession):
    """Seed domains from seed_data.py"""
    logger.info("Seeding domains...")
    
    for domain_data in seed_data.DOMAINS:
        # Check if domain already exists
        existing = await db.execute(
            select(Domain).where(Domain.type == domain_data["type"])
        )
        if existing.scalar_one_or_none():
            logger.debug(f"Domain {domain_data['type']} already exists, skipping")
            continue
        
        # Create domain
        domain = Domain(
            name=domain_data["name"],
            type=domain_data["type"],
            icon=domain_data.get("icon"),
            description=domain_data.get("description"),
            status=domain_data["status"]
        )
        db.add(domain)
        logger.info(f"Created domain: {domain_data['name']} ({domain_data['type']})")
    
    await db.commit()
    logger.info("Domains seeded successfully")


async def seed_ppe_types(db: AsyncSession):
    """Seed PPE types from seed_data.py"""
    logger.info("Seeding PPE types...")
    
    for ppe_data in seed_data.PPE_TYPES:
        # Check if PPE type already exists
        existing = await db.execute(
            select(PPEType).where(PPEType.name == ppe_data["name"])
        )
        if existing.scalar_one_or_none():
            logger.debug(f"PPE type {ppe_data['name']} already exists, skipping")
            continue
        
        # Create PPE type
        ppe_type = PPEType(
            name=ppe_data["name"],
            display_name=ppe_data["display_name"],
            category=ppe_data["category"],
            model_class_name=ppe_data.get("model_class_name"),
            status=ppe_data["status"]
        )
        db.add(ppe_type)
        logger.info(f"Created PPE type: {ppe_data['name']}")
    
    await db.commit()
    logger.info("PPE types seeded successfully")


async def seed_domain_rules(db: AsyncSession):
    """Seed domain PPE rules from seed_data.py"""
    logger.info("Seeding domain PPE rules...")
    
    # Get all domains and PPE types for mapping
    # Map by seed_data ID to actual database ID
    domains_result = await db.execute(select(Domain))
    all_domains = domains_result.scalars().all()
    # Create mapping: seed_data id -> database id
    domain_id_map = {}
    for seed_domain in seed_data.DOMAINS:
        db_domain = next((d for d in all_domains if d.type == seed_domain["type"]), None)
        if db_domain:
            domain_id_map[seed_domain["id"]] = db_domain.id
    
    ppe_types_result = await db.execute(select(PPEType))
    all_ppe_types = ppe_types_result.scalars().all()
    # Create mapping: seed_data id -> database id
    ppe_id_map = {}
    for seed_ppe in seed_data.PPE_TYPES:
        db_ppe = next((pt for pt in all_ppe_types if pt.name == seed_ppe["name"]), None)
        if db_ppe:
            ppe_id_map[seed_ppe["id"]] = db_ppe.id
    
    for rule_data in seed_data.DOMAIN_PPE_RULES:
        seed_domain_id = rule_data["domain_id"]
        seed_ppe_id = rule_data["ppe_type_id"]
        
        # Map seed IDs to database IDs
        domain_id = domain_id_map.get(seed_domain_id)
        ppe_type_id = ppe_id_map.get(seed_ppe_id)
        
        if not domain_id or not ppe_type_id:
            logger.warning(f"Could not map rule: domain_id={seed_domain_id}, ppe_type_id={seed_ppe_id}")
            continue
        
        # Check if rule already exists
        existing = await db.execute(
            select(DomainPPERule).where(
                DomainPPERule.domain_id == domain_id,
                DomainPPERule.ppe_type_id == ppe_type_id
            )
        )
        if existing.scalar_one_or_none():
            logger.debug(f"Rule for domain {domain_id}, PPE {ppe_type_id} already exists, skipping")
            continue
        
        # Create rule
        rule = DomainPPERule(
            domain_id=domain_id,
            ppe_type_id=ppe_type_id,
            is_required=rule_data.get("is_required", True),
            priority=rule_data.get("priority", 1),
            warning_message=rule_data.get("warning_message")
        )
        db.add(rule)
        logger.debug(f"Created rule: domain {domain_id}, PPE {ppe_type_id}")
    
    await db.commit()
    logger.info("Domain PPE rules seeded successfully")


async def seed_organizations(db: AsyncSession):
    """Seed default organization"""
    logger.info("Seeding organizations...")
    
    # Check if default organization exists
    existing = await crud.get_organization_by_id(db, 1)
    if existing:
        logger.debug("Default organization already exists, skipping")
        return
    
    # Create default organization
    default_org = await crud.create_organization(db, "Default Organization")
    logger.info(f"Created default organization: {default_org.name} (ID: {default_org.id})")


async def seed_all(db: AsyncSession):
    """Seed all initial data"""
    logger.info("Starting database seeding...")
    
    try:
        await seed_organizations(db)
        await seed_domains(db)
        await seed_ppe_types(db)
        await seed_domain_rules(db)
        logger.info("Database seeding completed successfully")
    except Exception as e:
        logger.error(f"Error during database seeding: {e}", exc_info=True)
        raise

