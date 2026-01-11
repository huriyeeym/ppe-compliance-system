"""
Update database to English translations
"""
import sqlite3

# Connect to database
conn = sqlite3.connect('backend/database/ppe_safety.db')
cursor = conn.cursor()

print("Updating domains to English...")
domains_updates = [
    (1, 'Construction', 'Construction sites, open-area building projects'),
    (2, 'Manufacturing', 'Factory, production lines, assembly areas'),
    (3, 'Mining', 'Underground/surface mining operations'),
    (4, 'Healthcare', 'Hospitals, clinics, medical laboratories'),
    (5, 'Food Production', 'Food processing facilities, industrial kitchens'),
]

for domain_id, name, description in domains_updates:
    cursor.execute(
        "UPDATE domains SET name = ?, description = ? WHERE id = ?",
        (name, description, domain_id)
    )
    print(f"  ✓ Updated domain {domain_id}: {name}")

print("\nUpdating PPE types to English...")
ppe_updates = [
    (1, 'Hard Hat'),
    (2, 'Safety Vest'),
    (3, 'Safety Boots'),
    (4, 'Safety Glasses'),
    (5, 'Face Mask'),
    (6, 'Gloves'),
    (7, 'Ear Protection'),
    (8, 'Protective Clothing'),
    (9, 'Welding Helmet'),
    (10, 'Respirator'),
    (20, 'Mining Helmet with Lamp'),
    (21, 'Dust Mask'),
    (22, 'Steel-Toe Boots'),
    (30, 'Surgical Mask'),
    (31, 'Lab Coat'),
    (32, 'Medical Gloves'),
    (33, 'Face Shield'),
    (40, 'Hairnet'),
    (41, 'Food Apron'),
    (42, 'Food Gloves'),
]

for ppe_id, display_name in ppe_updates:
    cursor.execute(
        "UPDATE ppe_types SET display_name = ? WHERE id = ?",
        (display_name, ppe_id)
    )
    print(f"  ✓ Updated PPE {ppe_id}: {display_name}")

print("\nUpdating warning messages to English...")
warning_updates = [
    (1, 1, 'Hard hat is required on construction sites!'),
    (1, 2, 'Safety vest is required on construction sites!'),
    (1, 3, 'Safety boots are recommended'),
    (2, 4, 'Safety glasses are required on production lines!'),
    (2, 7, 'Ear protection is required in noisy environments!'),
    (2, 6, 'Gloves are required for machine operators!'),
    (2, 1, 'Hard hat is required in certain areas'),
    (3, 20, 'Mining helmet with lamp is required in mines!'),
    (3, 21, 'Dust mask is required underground!'),
    (3, 22, 'Steel-toe boots are required in mines!'),
]

for domain_id, ppe_id, warning in warning_updates:
    cursor.execute(
        "UPDATE domain_ppe_rules SET warning_message = ? WHERE domain_id = ? AND ppe_type_id = ?",
        (warning, domain_id, ppe_id)
    )
    print(f"  ✓ Updated rule for domain {domain_id}, PPE {ppe_id}")

# Commit changes
conn.commit()
conn.close()

print("\n✅ All translations updated successfully!")
print("The interface is now fully in English.")
