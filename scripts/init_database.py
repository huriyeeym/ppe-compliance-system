"""
Database initialization script
Creates tables and loads seed data

Usage:
    python scripts/init_database.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.connection import init_db, AsyncSessionLocal
from backend.database.models import Domain, PPEType, DomainPPERule
from backend.database.seed_data import DOMAINS, PPE_TYPES, DOMAIN_PPE_RULES


async def load_seed_data():
    """Load seed data into database"""
    print("📦 Loading seed data...")
    
    async with AsyncSessionLocal() as session:
        # Check if data already exists
        from sqlalchemy import select
        result = await session.execute(select(Domain))
        existing_domains = result.scalars().all()
        
        if existing_domains:
            print("⚠️  Seed data already loaded. Skipping...")
            return
        
        # Load Domains
        print("  → Loading domains...")
        for domain_data in DOMAINS:
            domain = Domain(**domain_data)
            session.add(domain)
        await session.commit()
        print(f"  ✅ {len(DOMAINS)} domains loaded")
        
        # Load PPE Types
        print("  → Loading PPE types...")
        for ppe_data in PPE_TYPES:
            ppe_type = PPEType(**ppe_data)
            session.add(ppe_type)
        await session.commit()
        print(f"  ✅ {len(PPE_TYPES)} PPE types loaded")
        
        # Load Domain PPE Rules
        print("  → Loading domain PPE rules...")
        for rule_data in DOMAIN_PPE_RULES:
            rule = DomainPPERule(**rule_data)
            session.add(rule)
        await session.commit()
        print(f"  ✅ {len(DOMAIN_PPE_RULES)} domain rules loaded")


async def main():
    """Main initialization function"""
    print("=" * 60)
    print("🏗️  PPE Compliance System - Database Initialization")
    print("=" * 60)
    print()
    
    # Create tables
    print("🔧 Creating database tables...")
    await init_db()
    print()
    
    # Load seed data
    await load_seed_data()
    print()
    
    # Summary
    print("=" * 60)
    print("✅ Database initialization complete!")
    print("=" * 60)
    print()
    print("📊 Summary:")
    print(f"  • Database: data/ppe_compliance.db")
    print(f"  • Domains: {len(DOMAINS)} ({sum(1 for d in DOMAINS if d['status'].value == 'active')} active)")
    print(f"  • PPE Types: {len(PPE_TYPES)}")
    print(f"  • Rules: {len(DOMAIN_PPE_RULES)}")
    print()
    print("🚀 You can now start the backend:")
    print("   python backend/main.py")
    print()


if __name__ == "__main__":
    asyncio.run(main())

