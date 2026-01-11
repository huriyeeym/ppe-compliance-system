"""
Database Migration: Add duration_seconds column to violations table
Safely adds the new column without losing existing data
"""

import sqlite3
from pathlib import Path


def add_duration_column():
    """Add duration_seconds column to violations table"""

    db_path = Path("data/ppe_compliance.db")

    if not db_path.exists():
        print(f"[ERROR] Database not found at {db_path}")
        print("Run init_database.py first to create the database.")
        return

    try:
        # Connect to SQLite database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Check if column already exists
        cursor.execute("PRAGMA table_info(violations)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'duration_seconds' in columns:
            print("[OK] Column 'duration_seconds' already exists in violations table")
        else:
            print("Adding 'duration_seconds' column to violations table...")

            # Add the new column with default value 0
            cursor.execute("""
                ALTER TABLE violations
                ADD COLUMN duration_seconds INTEGER DEFAULT 0
            """)

            conn.commit()
            print("[OK] Successfully added 'duration_seconds' column!")

        # Verify the change
        cursor.execute("PRAGMA table_info(violations)")
        columns = cursor.fetchall()

        print("\nCurrent violations table schema:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

        conn.close()

        print("\n[OK] Migration completed successfully!")
        print("   Existing violation data has been preserved.")
        print("   New violations will track duration_seconds field.")

    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    add_duration_column()
