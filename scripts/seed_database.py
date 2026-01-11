"""
Seed Database with Initial Data
Populates database with domains, PPE types, and rules
"""

import sys
import asyncio
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.database.connection import AsyncSessionLocal, init_db
from backend.database import crud, schemas
from backend.database.seed_data import DOMAINS, PPE_TYPES, DOMAIN_PPE_RULES
from backend.utils.logger import logger


async def seed_database():
    """Seed database with initial data"""
    
    print("=" * 60)
    print("Database Seeding")
    print("=" * 60)
    print()
    
    # Initialize database (create tables)
    print("1. Initializing database...")
    await init_db()
    print("   ✓ Database tables created")
    print()
    
    async with AsyncSessionLocal() as db:
        # 2. Seed Domains
        print("2. Seeding domains...")
        domain_count = 0
        for domain_data in DOMAINS:
            # Check if domain already exists
            existing = await crud.get_domain_by_id(db, domain_data["id"])
            if existing:
                print(f"   - Domain '{domain_data['name']}' already exists (skipping)")
                continue
            
            domain_create = schemas.DomainCreate(**{k: v for k, v in domain_data.items() if k != "id"})
            domain = await crud.create_domain(db, domain=domain_create)
            domain_count += 1
            print(f"   ✓ Created domain: {domain.name} ({domain.type})")
        
        print(f"   Total: {domain_count} new domains created")
        print()
        
        # 3. Seed PPE Types
        print("3. Seeding PPE types...")
        ppe_count = 0
        for ppe_data in PPE_TYPES:
            # Check if PPE type already exists by name
            from sqlalchemy import select
            from backend.database.models import PPEType
            result = await db.execute(select(PPEType).where(PPEType.name == ppe_data["name"]))
            existing = result.scalar_one_or_none()
            if existing:
                print(f"   - PPE type '{ppe_data['name']}' already exists (skipping)")
                continue
            
            ppe_create = schemas.PPETypeCreate(**{k: v for k, v in ppe_data.items() if k != "id"})
            ppe_type = await crud.create_ppe_type(db, ppe_type=ppe_create)
            ppe_count += 1
            print(f"   ✓ Created PPE type: {ppe_type.display_name}")
        
        print(f"   Total: {ppe_count} new PPE types created")
        print()
        
        # 4. Seed Domain PPE Rules
        print("4. Seeding domain PPE rules...")
        rule_count = 0
        for rule_data in DOMAIN_PPE_RULES:
            # Check if rule already exists
            from backend.database.models import DomainPPERule
            result = await db.execute(
                select(DomainPPERule).where(
                    DomainPPERule.domain_id == rule_data["domain_id"],
                    DomainPPERule.ppe_type_id == rule_data["ppe_type_id"]
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                print(f"   - Rule for domain {rule_data['domain_id']}, PPE {rule_data['ppe_type_id']} already exists (skipping)")
                continue
            
            rule_create = schemas.DomainPPERuleCreate(**rule_data)
            rule = await crud.create_domain_rule(db, rule=rule_create)
            rule_count += 1
            print(f"   ✓ Created rule: Domain {rule.domain_id} → PPE {rule.ppe_type_id}")
        
        print(f"   Total: {rule_count} new rules created")
        print()
        
        await db.commit()
    
    print("=" * 60)
    print("✓ Database seeding completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        asyncio.run(seed_database())
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

