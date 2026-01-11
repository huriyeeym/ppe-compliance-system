"""
Database Migration: Add model_status and model_last_updated to domains table
Adds model management fields to track domain-specific model status
"""

import sqlite3
from pathlib import Path
from datetime import datetime

def add_model_status_fields():
    """Add model_status and model_last_updated columns to domains table"""

    db_path = Path("data/ppe_compliance.db")

    if not db_path.exists():
        print(f"[ERROR] Database not found at {db_path}")
        print("Run init_database.py first to create the database.")
        return

    try:
        # Connect to SQLite database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Check if columns already exist
        cursor.execute("PRAGMA table_info(domains)")
        columns = [col[1] for col in cursor.fetchall()]

        changes_made = False

        # Add model_status column if it doesn't exist
        if 'model_status' not in columns:
            print("Adding 'model_status' column to domains table...")

            cursor.execute("""
                ALTER TABLE domains
                ADD COLUMN model_status VARCHAR(20) DEFAULT 'not_loaded' NOT NULL
            """)

            changes_made = True
            print("[OK] Successfully added 'model_status' column!")
        else:
            print("[OK] Column 'model_status' already exists")

        # Add model_last_updated column if it doesn't exist
        if 'model_last_updated' not in columns:
            print("Adding 'model_last_updated' column to domains table...")

            cursor.execute("""
                ALTER TABLE domains
                ADD COLUMN model_last_updated DATETIME
            """)

            changes_made = True
            print("[OK] Successfully added 'model_last_updated' column!")
        else:
            print("[OK] Column 'model_last_updated' already exists")

        if changes_made:
            conn.commit()

        # Verify the changes
        cursor.execute("PRAGMA table_info(domains)")
        columns = cursor.fetchall()

        print("\nCurrent domains table schema:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        conn.close()

        print("\n[OK] Migration completed successfully!")
        if changes_made:
            print("   New model management fields added to domains table.")
        else:
            print("   All fields already exist, no changes needed.")

    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

if __name__ == "__main__":
    add_model_status_fields()
