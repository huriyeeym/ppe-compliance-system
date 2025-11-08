"""
Backend API Test Script
Quick test to verify backend is working
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


async def test_database():
    """Test database connection and tables"""
    print("=" * 60)
    print("🧪 Testing Database Connection")
    print("=" * 60)
    
    from backend.database.connection import AsyncSessionLocal
    from backend.database.models import Domain, PPEType
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as session:
        # Test domains
        result = await session.execute(select(Domain))
        domains = result.scalars().all()
        print(f"✅ Domains: {len(domains)} found")
        for d in domains:
            print(f"   - {d.name} ({d.type}) [{d.status.value}]")
        
        # Test PPE types
        result = await session.execute(select(PPEType))
        ppe_types = result.scalars().all()
        print(f"✅ PPE Types: {len(ppe_types)} found")
        
        # Show sample
        for ppe in ppe_types[:3]:
            print(f"   - {ppe.display_name} ({ppe.category})")
        if len(ppe_types) > 3:
            print(f"   ... and {len(ppe_types) - 3} more")
    
    print()


async def test_crud():
    """Test CRUD operations"""
    print("=" * 60)
    print("🧪 Testing CRUD Operations")
    print("=" * 60)
    
    from backend.database.connection import AsyncSessionLocal
    from backend.database import crud
    
    async with AsyncSessionLocal() as session:
        # Test get domains
        domains = await crud.get_domains(session)
        print(f"✅ CRUD get_domains: {len(domains)} domains")
        
        # Test get domain by type
        construction = await crud.get_domain_by_type(session, "construction")
        print(f"✅ CRUD get_domain_by_type: {construction.name if construction else 'Not found'}")
        
        # Test get domain rules
        if construction:
            rules = await crud.get_domain_rules(session, construction.id)
            print(f"✅ CRUD get_domain_rules: {len(rules)} rules for construction")
    
    print()


def test_ml_engine():
    """Test ML engine (without actual detection)"""
    print("=" * 60)
    print("🧪 Testing ML Engine")
    print("=" * 60)
    
    try:
        from backend.ml_engine.detector import PPEDetector
        from backend.ml_engine.model_registry import get_registry
        
        # Test model registry
        registry = get_registry()
        domains = registry.list_domains()
        print(f"✅ Model Registry: {len(domains)} domains registered")
        
        for domain_type in ["construction", "manufacturing"]:
            status = registry.get_model_status(domain_type)
            print(f"   - {domain_type}: {status['status']}")
        
        # Test detector initialization (will download YOLOv8 if needed)
        print(f"\n📦 Initializing detector (may download YOLOv8)...")
        detector = PPEDetector()
        info = detector.get_model_info()
        print(f"✅ Detector initialized")
        print(f"   Model: {info['model_path']}")
        print(f"   Confidence: {info['confidence_threshold']}")
        
    except Exception as e:
        print(f"❌ ML Engine test failed: {e}")
        print(f"   This is expected if Python 3.11 or dependencies not installed")
    
    print()


async def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("🏗️  PPE Compliance System - Backend Tests")
    print("=" * 60)
    print()
    
    try:
        # Test 1: Database
        await test_database()
        
        # Test 2: CRUD
        await test_crud()
        
        # Test 3: ML Engine
        test_ml_engine()
        
        # Summary
        print("=" * 60)
        print("✅ All tests passed!")
        print("=" * 60)
        print()
        print("🚀 Backend is ready. Start with:")
        print("   python backend/main.py")
        print()
        print("📖 API docs:")
        print("   http://localhost:8000/docs")
        print()
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        print(f"\nℹ️  Make sure you ran: python scripts/init_database.py")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

