"""
Fix System Admin domains - remove old 6 domain records and keep only 4 current domains
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, delete, insert
from backend.config import settings
from backend.database.models import user_domains, User, Domain, organization_domains


async def fix_system_admin_domains():
    """Fix System Admin domains to match organization domains"""
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Get System Admin user (id=1)
        result = await db.execute(select(User).where(User.id == 1))
        system_admin = result.scalar_one_or_none()
        
        if not system_admin:
            print("System Admin user not found!")
            return
        
        print(f"System Admin: {system_admin.email}, Organization ID: {system_admin.organization_id}")
        
        # Get organization domains for System Admin's organization
        if system_admin.organization_id:
            org_domains_result = await db.execute(
                select(organization_domains.c.domain_id)
                .where(organization_domains.c.organization_id == system_admin.organization_id)
            )
            org_domain_ids = [row[0] for row in org_domains_result.fetchall()]
            print(f"Organization {system_admin.organization_id} domains: {org_domain_ids}")
        else:
            # If no organization, get all active domains
            domains_result = await db.execute(select(Domain.id).where(Domain.status == "active"))
            org_domain_ids = [row[0] for row in domains_result.fetchall()]
            print(f"All active domains (no organization): {org_domain_ids}")
        
        # Get current System Admin domains
        current_domains_result = await db.execute(
            select(user_domains.c.domain_id)
            .where(user_domains.c.user_id == 1)
        )
        current_domain_ids = [row[0] for row in current_domains_result.fetchall()]
        print(f"Current System Admin domains: {current_domain_ids}")
        
        # Remove all existing System Admin domain associations
        await db.execute(delete(user_domains).where(user_domains.c.user_id == 1))
        print("Removed all existing System Admin domain associations")
        
        # Add new domain associations based on organization domains
        if org_domain_ids:
            await db.execute(
                insert(user_domains).values([
                    {"user_id": 1, "domain_id": domain_id}
                    for domain_id in org_domain_ids
                ])
            )
            print(f"Added {len(org_domain_ids)} domain associations for System Admin")
        
        await db.commit()
        print("✅ System Admin domains fixed!")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_system_admin_domains())
