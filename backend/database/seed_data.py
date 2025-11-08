"""
Seed data for PPE Compliance System
Loads initial domains, PPE types, and rules
"""

from backend.database.models import Domain, PPEType, DomainPPERule, DomainStatus

# ==========================================
# DOMAINS (5 total: 2 active, 3 planned)
# ==========================================

DOMAINS = [
    {
        "id": 1,
        "name": "İnşaat Alanı",
        "type": "construction",
        "icon": "🏗️",
        "description": "İnşaat şantiyesi, açık alan yapım işleri",
        "status": DomainStatus.ACTIVE  # Model eğitildi
    },
    {
        "id": 2,
        "name": "Üretim Sanayi",
        "type": "manufacturing",
        "icon": "🏭",
        "description": "Fabrika, üretim bandı, montaj alanı",
        "status": DomainStatus.ACTIVE  # Model eğitildi
    },
    {
        "id": 3,
        "name": "Madencilik",
        "type": "mining",
        "icon": "⛏️",
        "description": "Yeraltı/yerüstü maden ocakları",
        "status": DomainStatus.PLANNED  # Model yok (henüz)
    },
    {
        "id": 4,
        "name": "Sağlık/Hastane",
        "type": "healthcare",
        "icon": "🏥",
        "description": "Hastane, klinik, tıbbi laboratuvar",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 5,
        "name": "Gıda Üretimi",
        "type": "food_production",
        "icon": "🍔",
        "description": "Gıda işleme tesisi, endüstriyel mutfak",
        "status": DomainStatus.PLANNED
    }
]

# ==========================================
# PPE TYPES (All domains)
# ==========================================

PPE_TYPES = [
    # ========== İNŞAAT PPE'leri (Domain 1) ==========
    {
        "id": 1,
        "name": "hard_hat",
        "display_name": "Baret",
        "category": "head",
        "model_class_name": "hardhat",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 2,
        "name": "safety_vest",
        "display_name": "Reflektif Yelek",
        "category": "body",
        "model_class_name": "safety_vest",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 3,
        "name": "safety_boots",
        "display_name": "Güvenlik Botu",
        "category": "foot",
        "model_class_name": "boots",
        "status": DomainStatus.ACTIVE
    },
    
    # ========== ÜRETİM SANAYİ PPE'leri (Domain 2) ==========
    {
        "id": 4,
        "name": "safety_glasses",
        "display_name": "Koruyucu Gözlük",
        "category": "eye",
        "model_class_name": "goggles",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 5,
        "name": "face_mask",
        "display_name": "Maske",
        "category": "face",
        "model_class_name": "mask",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 6,
        "name": "gloves",
        "display_name": "Eldiven",
        "category": "hand",
        "model_class_name": "gloves",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 7,
        "name": "ear_protection",
        "display_name": "Kulaklık (İşitme Koruyucu)",
        "category": "ear",
        "model_class_name": "earmuff",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 8,
        "name": "protective_clothing",
        "display_name": "Koruyucu Giysi",
        "category": "body",
        "model_class_name": "protective_suit",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 9,
        "name": "welding_helmet",
        "display_name": "Kaynak Maskesi",
        "category": "head",
        "model_class_name": "welding_mask",
        "status": DomainStatus.ACTIVE
    },
    {
        "id": 10,
        "name": "respirator",
        "display_name": "Solunum Maskesi",
        "category": "face",
        "model_class_name": "respirator",
        "status": DomainStatus.ACTIVE
    },
    
    # ========== MADENCİLİK PPE'leri (Domain 3 - PLANNED) ==========
    {
        "id": 20,
        "name": "mining_helmet_with_lamp",
        "display_name": "Madenci Bareti (Kafa Lambası)",
        "category": "head",
        "model_class_name": "mining_helmet",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 21,
        "name": "dust_mask",
        "display_name": "Toz Maskesi",
        "category": "face",
        "model_class_name": "dust_mask",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 22,
        "name": "steel_toe_boots",
        "display_name": "Çelik Burunlu Bot",
        "category": "foot",
        "model_class_name": "steel_boots",
        "status": DomainStatus.PLANNED
    },
    
    # ========== SAĞLIK PPE'leri (Domain 4 - PLANNED) ==========
    {
        "id": 30,
        "name": "surgical_mask",
        "display_name": "Cerrahi Maske",
        "category": "face",
        "model_class_name": "surgical_mask",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 31,
        "name": "lab_coat",
        "display_name": "Önlük",
        "category": "body",
        "model_class_name": "lab_coat",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 32,
        "name": "medical_gloves",
        "display_name": "Medikal Eldiven",
        "category": "hand",
        "model_class_name": "medical_gloves",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 33,
        "name": "face_shield",
        "display_name": "Yüz Siperliği",
        "category": "face",
        "model_class_name": "face_shield",
        "status": DomainStatus.PLANNED
    },
    
    # ========== GIDA PPE'leri (Domain 5 - PLANNED) ==========
    {
        "id": 40,
        "name": "hairnet",
        "display_name": "Bone / Saç Filesi",
        "category": "head",
        "model_class_name": "hairnet",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 41,
        "name": "food_apron",
        "display_name": "Gıda Önlüğü",
        "category": "body",
        "model_class_name": "apron",
        "status": DomainStatus.PLANNED
    },
    {
        "id": 42,
        "name": "food_gloves",
        "display_name": "Gıda Eldiveni",
        "category": "hand",
        "model_class_name": "food_gloves",
        "status": DomainStatus.PLANNED
    }
]

# ==========================================
# DOMAIN PPE RULES (Hangi domain hangi PPE'yi gerektiriyor)
# ==========================================

DOMAIN_PPE_RULES = [
    # ========== İNŞAAT KURALLARI (Domain 1) ==========
    {
        "domain_id": 1,
        "ppe_type_id": 1,  # Baret
        "is_required": True,
        "priority": 1,
        "warning_message": "İnşaat alanında baret zorunludur!"
    },
    {
        "domain_id": 1,
        "ppe_type_id": 2,  # Yelek
        "is_required": True,
        "priority": 1,
        "warning_message": "İnşaat alanında reflektif yelek zorunludur!"
    },
    {
        "domain_id": 1,
        "ppe_type_id": 3,  # Güvenlik Botu
        "is_required": False,
        "priority": 2,
        "warning_message": "Güvenlik botu önerilir"
    },
    
    # ========== ÜRETİM SANAYİ KURALLARI (Domain 2) ==========
    {
        "domain_id": 2,
        "ppe_type_id": 4,  # Gözlük
        "is_required": True,
        "priority": 1,
        "warning_message": "Üretim bandında koruyucu gözlük zorunludur!"
    },
    {
        "domain_id": 2,
        "ppe_type_id": 7,  # Kulaklık
        "is_required": True,
        "priority": 1,
        "warning_message": "Gürültülü ortamda kulaklık zorunludur!"
    },
    {
        "domain_id": 2,
        "ppe_type_id": 6,  # Eldiven
        "is_required": True,
        "priority": 2,
        "warning_message": "Makine operatörleri için eldiven zorunludur!"
    },
    {
        "domain_id": 2,
        "ppe_type_id": 1,  # Baret (üretimde de)
        "is_required": False,
        "priority": 2,
        "warning_message": "Belirli alanlarda baret gereklidir"
    },
    
    # ========== MADENCİLİK KURALLARI (Domain 3 - PLANNED) ==========
    {
        "domain_id": 3,
        "ppe_type_id": 20,  # Madenci Bareti
        "is_required": True,
        "priority": 1,
        "warning_message": "Maden ocağında kafa lambası zorunludur!"
    },
    {
        "domain_id": 3,
        "ppe_type_id": 21,  # Toz Maskesi
        "is_required": True,
        "priority": 1,
        "warning_message": "Yeraltında toz maskesi zorunludur!"
    },
    {
        "domain_id": 3,
        "ppe_type_id": 22,  # Çelik Burunlu Bot
        "is_required": True,
        "priority": 1,
        "warning_message": "Maden botları zorunludur!"
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
    print(f"[i] Seed Data Stats:")
    print(f"  Domains: {stats['total']} (Active: {stats['active']}, Planned: {stats['planned']})")
    print(f"  PPE Types: {len(PPE_TYPES)}")
    print(f"  Domain Rules: {len(DOMAIN_PPE_RULES)}")
    
    print("\n[i] Construction Domain PPE:")
    construction_ppe = get_ppe_types_by_domain(1)
    print(f"  Required: {len(construction_ppe['required'])}")
    print(f"  Optional: {len(construction_ppe['optional'])}")
    
    print("\n[i] Manufacturing Domain PPE:")
    manufacturing_ppe = get_ppe_types_by_domain(2)
    print(f"  Required: {len(manufacturing_ppe['required'])}")
    print(f"  Optional: {len(manufacturing_ppe['optional'])}")

