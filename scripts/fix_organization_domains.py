"""
Fix organization_domains table to have only 4 domains:
- Construction (id: 1)
- Manufacturing (id: 2)
- Mining (id: 3)
- Warehouse (id: 6)

Remove: Healthcare (id: 4), Food Production (id: 5)
Add: Warehouse (id: 6) if missing
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path.parent))

from sqlalchemy import select, delete, and_
from backend.database.connection import AsyncSessionLocal
from backend.database.models import organization_domains, Domain
from backend.utils.logger import logger


async def fix_organization_domains():
    """
    Fix organization_id=1 to have only the 4 correct domains
    """
    async with AsyncSessionLocal() as db:
        try:
            # Target organization
            org_id = 1
            
            # Correct domain IDs
            correct_domain_ids = [1, 2, 3, 6]  # Construction, Manufacturing, Mining, Warehouse
            
            # Domain names for logging
            domain_names = {
                1: "Construction",
                2: "Manufacturing",
                3: "Mining",
                4: "Healthcare",
                5: "Food Production",
                6: "Warehouse"
            }
            
            # Get current organization domains
            result = await db.execute(
                select(organization_domains.c.domain_id)
                .where(organization_domains.c.organization_id == org_id)
            )
            current_domain_ids = [row[0] for row in result.all()]
            
            logger.info(f"Current organization {org_id} domains: {[domain_names.get(did, f'ID:{did}') for did in current_domain_ids]}")
            
            # Remove incorrect domains (Healthcare=4, Food Production=5)
            domains_to_remove = [4, 5]
            for domain_id in domains_to_remove:
                if domain_id in current_domain_ids:
                    await db.execute(
                        delete(organization_domains)
                        .where(
                            and_(
                                organization_domains.c.organization_id == org_id,
                                organization_domains.c.domain_id == domain_id
                            )
                        )
                    )
                    logger.info(f"Removed {domain_names[domain_id]} (id: {domain_id}) from organization {org_id}")
            
            # Add Warehouse (id: 6) if missing
            if 6 not in current_domain_ids:
                await db.execute(
                    organization_domains.insert().values(
                        organization_id=org_id,
                        domain_id=6,
                        created_at=__import__('datetime').datetime.utcnow()
                    )
                )
                logger.info(f"Added {domain_names[6]} (id: 6) to organization {org_id}")
            
            await db.commit()
            
            # Verify final state
            result = await db.execute(
                select(organization_domains.c.domain_id)
                .where(organization_domains.c.organization_id == org_id)
            )
            final_domain_ids = sorted([row[0] for row in result.all()])
            
            logger.info(f"Final organization {org_id} domains: {[domain_names.get(did, f'ID:{did}') for did in final_domain_ids]}")
            
            if set(final_domain_ids) == set(correct_domain_ids):
                logger.info("SUCCESS: Organization domains fixed correctly!")
                print(f"\n[SUCCESS] Organization {org_id} now has {len(final_domain_ids)} domains:")
                for did in final_domain_ids:
                    print(f"  - {domain_names[did]} (id: {did})")
            else:
                logger.error(f"ERROR: Expected domains {correct_domain_ids}, got {final_domain_ids}")
                print(f"\n[ERROR] Expected domains {correct_domain_ids}, got {final_domain_ids}")
                return False
                
        except Exception as e:
            logger.error(f"Error fixing organization domains: {e}", exc_info=True)
            await db.rollback()
            print(f"\n[ERROR] Failed to fix organization domains: {e}")
            return False
    
    return True


if __name__ == "__main__":
    print("Fixing organization_domains table...")
    print("Target: Organization ID 1 should have only 4 domains:")
    print("  - Construction (id: 1)")
    print("  - Manufacturing (id: 2)")
    print("  - Mining (id: 3)")
    print("  - Warehouse (id: 6)")
    print("\nRemoving: Healthcare (id: 4), Food Production (id: 5)")
    print("Adding: Warehouse (id: 6) if missing\n")
    
    success = asyncio.run(fix_organization_domains())
    sys.exit(0 if success else 1)

