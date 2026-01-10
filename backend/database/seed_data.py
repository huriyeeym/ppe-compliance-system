"""
Seed data for PPE Compliance System
Loads initial domains, PPE types, and rules
"""

from backend.database.models import Domain, PPEType, DomainPPERule, DomainStatus
from backend.utils.logger import logger

# ==========================================
# DOMAINS (6 total: 4 active, 2 planned)
# Active: Construction, Manufacturing, Mining, Warehouse
# Planned: Healthcare, Food Production
# ==========================================

DOMAINS = [
    {
        "id": 1,
        "name": "Construction",
        "type": "construction",
        "icon": "⚒",  # Hammer and pick - construction tools
        "description": "Construction sites, open-area building projects",
        "status": DomainStatus.ACTIVE  # Model trained
    },
    {
        "id": 2,
        "name": "Manufacturing",
        "type": "manufacturing",
        "icon": "⚙",  # Gear - industrial machinery
        "description": "Factory, production lines, assembly areas",
        "status": DomainStatus.ACTIVE  # Model trained
    },
    {
        "id": 3,
        "name": "Mining",
        "type": "mining",
        "icon": "⛏",  # Pickaxe - mining tool
        "description": "Underground/surface mining operations",
        "status": DomainStatus.ACTIVE  # Model trained
    },
    {
        "id": 4,
        "name": "Healthcare",
        "type": "healthcare",
        "icon": "⚕",  # Rod of Asclepius - medical symbol
        "description": "Hospitals, clinics, medical laboratories",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 5,
        "name": "Food Production",
        "type": "food_production",
        "icon": "🍴",  # Fork and knife - food service
        "description": "Food processing facilities, industrial kitchens",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 6,
        "name": "Warehouse",
        "type": "warehouse",
        "icon": "📦",  # Package - warehouse symbol
        "description": "Warehouses, storage facilities, logistics centers",
        "status": DomainStatus.ACTIVE  # Model trained
    }
]

# ==========================================
# PPE TYPES (All domains)
# ==========================================

PPE_TYPES = [
    # ========== CONSTRUCTION PPE (Domain 1) ==========
    {
        "id": 1,
        "name": "hard_hat",
        "display_name": "Hard Hat",
        "category": "head",
        "model_class_name": "hardhat",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 2,
        "name": "safety_vest",
        "display_name": "Safety Vest",
        "category": "body",
        "model_class_name": "safety_vest",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 3,
        "name": "safety_boots",
        "display_name": "Safety Boots",
        "category": "foot",
        "model_class_name": "boots",
        "status": DomainStatus.ACTIVE
    },

    # ========== MANUFACTURING PPE (Domain 2) ==========
    {
        "id": 4,
        "name": "safety_glasses",
        "display_name": "Safety Glasses",
        "category": "eye",
        "model_class_name": "goggles",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 5,
        "name": "face_mask",
        "display_name": "Face Mask",
        "category": "face",
        "model_class_name": "mask",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 6,
        "name": "gloves",
        "display_name": "Gloves",
        "category": "hand",
        "model_class_name": "gloves",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 7,
        "name": "ear_protection",
        "display_name": "Ear Protection",
        "category": "ear",
        "model_class_name": "earmuff",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 8,
        "name": "protective_clothing",
        "display_name": "Protective Clothing",
        "category": "body",
        "model_class_name": "protective_suit",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 9,
        "name": "welding_helmet",
        "display_name": "Welding Helmet",
        "category": "head",
        "model_class_name": "welding_mask",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 10,
        "name": "respirator",
        "display_name": "Respirator",
        "category": "face",
        "model_class_name": "respirator",
        "status": DomainStatus.ACTIVE
    },

    # ========== MINING PPE (Domain 3 - PLANNED) ==========
    {
        "id": 20,
        "name": "mining_helmet_with_lamp",
        "display_name": "Mining Helmet with Lamp",
        "category": "head",
        "model_class_name": "mining_helmet",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 21,
        "name": "dust_mask",
        "display_name": "Dust Mask",
        "category": "face",
        "model_class_name": "dust_mask",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 22,
        "name": "steel_toe_boots",
        "display_name": "Steel-Toe Boots",
        "category": "foot",
        "model_class_name": "steel_boots",
        "status": DomainStatus.PLANNED
    },

    # ========== HEALTHCARE PPE (Domain 4 - PLANNED) ==========
    {
        "id": 30,
        "name": "surgical_mask",
        "display_name": "Surgical Mask",
        "category": "face",
        "model_class_name": "surgical_mask",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 31,
        "name": "lab_coat",
        "display_name": "Lab Coat",
        "category": "body",
        "model_class_name": "lab_coat",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 32,
        "name": "medical_gloves",
        "display_name": "Medical Gloves",
        "category": "hand",
        "model_class_name": "medical_gloves",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 33,
        "name": "face_shield",
        "display_name": "Face Shield",
        "category": "face",
        "model_class_name": "face_shield",
        "status": DomainStatus.PLANNED
    },

    # ========== FOOD PRODUCTION PPE (Domain 5 - PLANNED) ==========
    {
        "id": 40,
        "name": "hairnet",
        "display_name": "Hairnet",
        "category": "head",
        "model_class_name": "hairnet",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 41,
        "name": "food_apron",
        "display_name": "Food Apron",
        "category": "body",
        "model_class_name": "apron",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 42,
        "name": "food_gloves",
        "display_name": "Food Gloves",
        "category": "hand",
        "model_class_name": "food_gloves",
        "status": DomainStatus.PLANNED
    }
]

# ==========================================
# DOMAIN PPE RULES (Hangi domain hangi PPE'yi gerektiriyor)
# ==========================================

DOMAIN_PPE_RULES = [
    # ========== CONSTRUCTION RULES (Domain 1) ==========
    {
        "domain_id": 1,
        "ppe_type_id": 1,  # Hard Hat
        "is_required": True,
        "priority": 1,
        "warning_message": "Hard hat is required on construction sites!"
    },
    {
        "domain_id": 1,
        "ppe_type_id": 2,  # Safety Vest
        "is_required": True,
        "priority": 1,
        "warning_message": "Safety vest is required on construction sites!"
    },
    {
        "domain_id": 1,
        "ppe_type_id": 3,  # Safety Boots
        "is_required": False,
        "priority": 2,
        "warning_message": "Safety boots are recommended"
    },

    # ========== MANUFACTURING RULES (Domain 2) ==========
    {
        "domain_id": 2,
        "ppe_type_id": 4,  # Safety Glasses
        "is_required": True,
        "priority": 1,
        "warning_message": "Safety glasses are required on production lines!"
    },
    {
        "domain_id": 2,
        "ppe_type_id": 7,  # Ear Protection
        "is_required": True,
        "priority": 1,
        "warning_message": "Ear protection is required in noisy environments!"
    },
    {
        "domain_id": 2,
        "ppe_type_id": 6,  # Gloves
        "is_required": True,
        "priority": 2,
        "warning_message": "Gloves are required for machine operators!"
    },
    {
        "domain_id": 2,
        "ppe_type_id": 1,  # Hard Hat (in manufacturing too)
        "is_required": False,
        "priority": 2,
        "warning_message": "Hard hat is required in certain areas"
    },

    # ========== MINING RULES (Domain 3) ==========
    {
        "domain_id": 3,
        "ppe_type_id": 1,  # Hard Hat (Mining Helmet - using same model class)
        "is_required": True,
        "priority": 1,
        "warning_message": "Hard hat/helmet is required in mines!"
    },
    {
        "domain_id": 3,
        "ppe_type_id": 2,  # Safety Vest
        "is_required": True,
        "priority": 1,
        "warning_message": "Safety vest is required in mining operations!"
    },
    {
        "domain_id": 3,
        "ppe_type_id": 5,  # Face Mask (Dust Mask - using same model class)
        "is_required": True,
        "priority": 1,
        "warning_message": "Dust mask is required underground!"
    },
    {
        "domain_id": 3,
        "ppe_type_id": 3,  # Safety Boots (Steel-Toe Boots)
        "is_required": True,
        "priority": 1,
        "warning_message": "Safety boots are required in mines!"
    },
    {
        "domain_id": 3,
        "ppe_type_id": 6,  # Gloves
        "is_required": True,
        "priority": 2,
        "warning_message": "Gloves are recommended for mining operations"
    },

    # ========== WAREHOUSE RULES (Domain 6) ==========
    {
        "domain_id": 6,
        "ppe_type_id": 1,  # Hard Hat
        "is_required": True,
        "priority": 1,
        "warning_message": "Hard hat is required in warehouse areas!"
    },
    {
        "domain_id": 6,
        "ppe_type_id": 2,  # Safety Vest
        "is_required": True,
        "priority": 1,
        "warning_message": "Safety vest is required for visibility in warehouses!"
    },
    {
        "domain_id": 6,
        "ppe_type_id": 3,  # Safety Boots
        "is_required": True,
        "priority": 1,
        "warning_message": "Safety boots are required in warehouse operations!"
    },
    {
        "domain_id": 6,
        "ppe_type_id": 6,  # Gloves
        "is_required": False,
        "priority": 2,
        "warning_message": "Gloves are recommended for handling materials"
    },
]


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_domain_count_by_status():
    """Returns count of domains by status"""
    active = sum(1 for d in DOMAINS if d["status"] == DomainStatus.ACTIVE)
    planned = sum(1 for d in DOMAINS if d["status"] == DomainStatus.PLANNED)
    return {"active": active, "planned": planned, "total": len(DOMAINS)}


def get_ppe_types_by_domain(domain_id: int):
    """Returns required PPE types for a specific domain"""
    rules = [r for r in DOMAIN_PPE_RULES if r["domain_id"] == domain_id]
    required = [r for r in rules if r["is_required"]]
    optional = [r for r in rules if not r["is_required"]]
    return {"required": required, "optional": optional}


if __name__ == "__main__":
    # Quick stats
    stats = get_domain_count_by_status()
    logger.info("Seed Data Stats:")
    logger.info(f"  Domains: {stats['total']} (Active: {stats['active']}, Planned: {stats['planned']})")
    logger.info(f"  PPE Types: {len(PPE_TYPES)}")
    logger.info(f"  Domain Rules: {len(DOMAIN_PPE_RULES)}")
    
    logger.info("Construction Domain PPE:")
    construction_ppe = get_ppe_types_by_domain(1)
    logger.info(f"  Required: {len(construction_ppe['required'])}")
    logger.info(f"  Optional: {len(construction_ppe['optional'])}")
    
    logger.info("Manufacturing Domain PPE:")
    manufacturing_ppe = get_ppe_types_by_domain(2)
    logger.info(f"  Required: {len(manufacturing_ppe['required'])}")
    logger.info(f"  Optional: {len(manufacturing_ppe['optional'])}")

