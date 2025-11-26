"""
Migration script: Add violation status workflow fields
Adds status, assigned_to, corrective_action columns to violations table
"""

import sqlite3
from pathlib import Path

def migrate():
    """Add status workflow fields to violations table"""
    db_path = Path("data/ppe_compliance.db")
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        # Check existing columns
        cur.execute("PRAGMA table_info(violations)")
        existing_cols = {row[1] for row in cur.fetchall()}
        
        # Add status column (default: 'open')
        if 'status' not in existing_cols:
            cur.execute("""
                ALTER TABLE violations 
                ADD COLUMN status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'closed', 'false_positive'))
            """)
            # Update existing violations to 'open' status
            cur.execute("UPDATE violations SET status = 'open' WHERE status IS NULL")
            print("✓ Added 'status' column")
        else:
            print("✓ 'status' column already exists")
        
        # Add assigned_to column
        if 'assigned_to' not in existing_cols:
            cur.execute("ALTER TABLE violations ADD COLUMN assigned_to TEXT")
            print("✓ Added 'assigned_to' column")
        else:
            print("✓ 'assigned_to' column already exists")
        
        # Add corrective_action column
        if 'corrective_action' not in existing_cols:
            cur.execute("ALTER TABLE violations ADD COLUMN corrective_action TEXT")
            print("✓ Added 'corrective_action' column")
        else:
            print("✓ 'corrective_action' column already exists")
        
        # Create index on status for faster filtering
        cur.execute("CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status)")
        print("✓ Created index on 'status' column")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()

