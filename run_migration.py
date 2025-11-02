#!/usr/bin/env python3
"""
Run database migration to add cache columns to GenCom.BaseInformation table
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

print("🔄 Running migration...")

try:
    # Read SQL file
    with open('database_migration_add_cache.sql', 'r') as f:
        sql_script = f.read()
    
    # Connect to database
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Execute migration
    cur.execute(sql_script)
    
    # Fetch any results
    if cur.description:
        result = cur.fetchone()
        if result:
            print(f"✅ {result[0]}")
    
    # Check for notices (RAISE NOTICE output)
    for notice in conn.notices:
        print(f"   {notice.strip()}")
    
    cur.close()
    conn.close()
    
    print("\n✅ Migration completed successfully!")
    print("\nNew columns added:")
    print("   - CachedAnalysisBasic (TEXT)")
    print("   - CachedAnalysisDetailed (TEXT)")
    print("   - AnalysisCachedAt (TIMESTAMP WITH TIME ZONE)")
    
except Exception as e:
    print(f"❌ Migration failed: {e}")
    exit(1)

