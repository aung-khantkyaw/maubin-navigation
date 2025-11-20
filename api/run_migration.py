#!/usr/bin/env python3
"""
Database Migration Script
Runs db_schema_fixed.sql against the configured database
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_connection():
    """Get database connection using environment variables"""
    host = os.environ.get('DB_HOST', '').strip()
    database = os.environ.get('DB_NAME', '').strip()
    user = os.environ.get('DB_USER', '').strip()
    password = os.environ.get('DB_PASSWORD', '').strip()
    port = os.environ.get('DB_PORT', '5432').strip()
    
    print(f"Connecting to: {host}:{port}/{database} as {user}")
    
    return psycopg2.connect(
        host=host,
        database=database,
        user=user,
        password=password,
        port=int(port),
        sslmode='require',
        connect_timeout=10
    )

def run_migration():
    """Run the migration SQL file"""
    # Read the SQL file
    sql_file_path = os.path.join(os.path.dirname(__file__), '..', 'db_schema_final.sql')
    
    if not os.path.exists(sql_file_path):
        print(f"ERROR: SQL file not found at {sql_file_path}")
        sys.exit(1)
    
    print(f"Reading migration file: {sql_file_path}")
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Connect and execute
    print("Connecting to database...")
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        print("Executing migration...")
        cur.execute(sql_content)
        conn.commit()
        print("✓ Migration completed successfully!")
        
        # Verify tables were created
        print("\nVerifying tables...")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cur.fetchall()
        print(f"✓ Found {len(tables)} tables:")
        for table in tables:
            print(f"  - {table[0]}")
            
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Migration failed!")
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    run_migration()
