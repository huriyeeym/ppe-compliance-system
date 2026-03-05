"""
Update PPE rules for each domain based on requirements
"""
import asyncio
import sys
sys.path.insert(0, '.')

from backend.database.connection import AsyncSessionLocal
from sqlalchemy import select, delete
from backend.database.models import Domain, DomainPPERule, PPEType

async def update_rules():
    async with AsyncSessionLocal() as db:
        # Domain-specific PPE requirements
        domain_requirements = {
            "construction": ["hard_hat", "safety_vest"],
            "manufacturing": ["safety_vest", "safety_glasses", "hard_hat", "gloves", "ear_protection"],
            "mining": ["face_mask", "hard_hat", "safety_vest", "safety_glasses"],
            "warehouse": ["hard_hat", "safety_vest", "safety_boots"],
        }

        # Get all domains
        result = await db.execute(select(Domain))
        domains = result.scalars().all()

        for domain in domains:
            if domain.type not in domain_requirements:
                print(f"WARNING: Skipping {domain.name} - no requirements defined")
                continue

            print(f"\nUpdating {domain.name} ({domain.type}):")

            # Delete existing rules for this domain
            await db.execute(
                delete(DomainPPERule).where(DomainPPERule.domain_id == domain.id)
            )

            # Add new rules
            required_ppe = domain_requirements[domain.type]
            for ppe_name in required_ppe:
                # Find PPE type
                result = await db.execute(
                    select(PPEType).where(PPEType.name == ppe_name)
                )
                ppe_type = result.scalar_one_or_none()

                if not ppe_type:
                    print(f"   ERROR: PPE type not found: {ppe_name}")
                    continue

                # Create rule
                rule = DomainPPERule(
                    domain_id=domain.id,
                    ppe_type_id=ppe_type.id,
                    is_required=True,
                    is_recommended=False
                )
                db.add(rule)
                print(f"   OK: Added {ppe_type.name} (model_class: {ppe_type.model_class_name})")

            await db.commit()

        print("\nSUCCESS: PPE rules updated!")

if __name__ == "__main__":
    asyncio.run(update_rules())
