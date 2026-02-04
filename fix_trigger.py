#!/usr/bin/env python3
"""
Fix database trigger to use lowercase column names
Fixes error: record "new" has no field "ModifiedDate"
"""
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DB_CONNECTION_STRING = os.getenv('DB_CONNECTION_STRING')

if not DB_CONNECTION_STRING:
    print("❌ Error: DB_CONNECTION_STRING not found in .env file")
    exit(1)

# Strip SQLAlchemy-style prefix if present
if "+psycopg2://" in DB_CONNECTION_STRING:
    DB_CONNECTION_STRING = DB_CONNECTION_STRING.replace("postgresql+psycopg2://", "postgresql://")

print("🔄 Fixing database trigger...")

try:
    # Read SQL file
    with open('fix_trigger_column_names.sql', 'r') as f:
        sql_script = f.read()
    
    # Connect to database
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Execute fix
    cur.execute(sql_script)
    
    # Fetch any results
    if cur.description:
        result = cur.fetchone()
        if result:
            print(f"✅ {result[0]}")
    
    # Check for notices
    for notice in conn.notices:
        print(f"   {notice.strip()}")
    
    cur.close()
    conn.close()
    
    print("\n✅ Trigger function updated successfully!")
    print("\nThe trigger now uses: NEW.modified_date (lowercase)")
    print("Previous: NEW.\"ModifiedDate\" (PascalCase)")
    
except Exception as e:
    print(f"❌ Fix failed: {e}")
    exit(1)
