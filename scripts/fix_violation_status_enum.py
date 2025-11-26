"""
Fix violation status enum values in database
Converts lowercase values ('open', 'in_progress', etc.) to uppercase enum names (OPEN, IN_PROGRESS, etc.)
"""

import sqlite3
from pathlib import Path
import sys
import re

# Add backend to path to import settings
sys.path.append(str(Path(__file__).resolve().parent.parent))
from backend.config import settings

def fix_status_values():
    """Update violation status values to match SQLAlchemy enum format"""
    db_path = settings.data_dir / "ppe_compliance.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        # Step 1: Get table schema and remove CHECK constraint
        cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='violations'")
        result = cur.fetchone()
        if not result:
            print("Violations table not found")
            return False
        
        table_sql = result[0]
        print("Original table schema found")
        
        # Check if CHECK constraint exists
        if "CHECK(status IN" in table_sql or "CHECK (status IN" in table_sql:
            print("Removing CHECK constraint...")
            
            # Remove CHECK constraint from SQL
            # Pattern: , CHECK(status IN (...)) or CHECK(status IN (...))
            table_sql_clean = re.sub(
                r',?\s*CHECK\s*\(status\s+IN\s*\([^)]+\)\)',
                '',
                table_sql,
                flags=re.IGNORECASE
            )
            
            # Create temp table without CHECK constraint
            temp_table_sql = table_sql_clean.replace(
                "CREATE TABLE violations",
                "CREATE TABLE violations_new"
            )
            
            # Create new table
            cur.execute(temp_table_sql)
            print("Created temporary table without CHECK constraint")
            
            # Get all column names (except the ones we're updating)
            cur.execute("PRAGMA table_info(violations)")
            columns = [row[1] for row in cur.fetchall()]
            columns_str = ", ".join(columns)
            
            # Copy all data to new table
            cur.execute(f"INSERT INTO violations_new SELECT {columns_str} FROM violations")
            print("Copied data to temporary table")
            
            # Drop old table
            cur.execute("DROP TABLE violations")
            print("Dropped old table")
            
            # Rename new table
            cur.execute("ALTER TABLE violations_new RENAME TO violations")
            print("Renamed temporary table to violations")
            
            # Recreate indexes
            try:
                cur.execute("CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp)")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_violations_acknowledged ON violations(acknowledged)")
                print("Recreated indexes")
            except Exception as e:
                print(f"Warning: Could not recreate some indexes: {e}")
        
        # Step 2: Update status values
        status_mapping = {
            'open': 'OPEN',
            'in_progress': 'IN_PROGRESS',
            'closed': 'CLOSED',
            'false_positive': 'FALSE_POSITIVE'
        }
        
        # Check current values
        cur.execute("SELECT DISTINCT status FROM violations WHERE status IS NOT NULL")
        current_values = [row[0] for row in cur.fetchall()]
        print(f"Current status values in DB: {current_values}")
        
        # Update each status value
        updated_count = 0
        for old_value, new_value in status_mapping.items():
            cur.execute(
                "UPDATE violations SET status = ? WHERE status = ?",
                (new_value, old_value)
            )
            count = cur.rowcount
            if count > 0:
                print(f"Updated {count} violations from '{old_value}' to '{new_value}'")
                updated_count += count
        
        # Also update any NULL values to OPEN
        cur.execute("UPDATE violations SET status = 'OPEN' WHERE status IS NULL")
        null_count = cur.rowcount
        if null_count > 0:
            print(f"Set {null_count} NULL status values to 'OPEN'")
            updated_count += null_count
        
        conn.commit()
        print(f"Successfully updated {updated_count} violation status values")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"Failed to fix status values: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    fix_status_values()
