#!/usr/bin/env python3
"""
Data Insertion Script
Inserts production data into Maubin Navigation database
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_connection():
    """Get database connection using environment variables"""
    host = os.getenv('DB_HOST')
    port = os.getenv('DB_PORT', '5432')
    database = os.getenv('DB_NAME')
    user = os.getenv('DB_USER')
    password = os.getenv('DB_PASSWORD')
    sslmode = os.getenv('DB_SSLMODE', 'require')
    
    print(f"Connecting to: {host}:{port}/{database} as {user}")
    
    conn = psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        sslmode=sslmode,
        connect_timeout=10
    )
    return conn

def insert_data():
    """Insert data from SQL file"""
    # Get the SQL file path (in parent directory)
    sql_file_path = os.path.join(os.path.dirname(__file__), '..', 'insert_data.sql')
    
    print(f"Reading data file: {os.path.abspath(sql_file_path)}")
    
    if not os.path.exists(sql_file_path):
        print(f"✗ Error: SQL file not found at {sql_file_path}")
        sys.exit(1)
    
    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("Connecting to database...")
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        print("Inserting data...")
        cur.execute(sql_content)
        conn.commit()
        print("✓ Data insertion completed successfully!")
        
        # Verify data
        print("\nVerifying data...")
        
        cur.execute("SELECT COUNT(*) FROM users;")
        user_count = cur.fetchone()[0]
        print(f"✓ Users: {user_count}")
        
        cur.execute("SELECT COUNT(*) FROM cities;")
        city_count = cur.fetchone()[0]
        print(f"✓ Cities: {city_count}")
        
        cur.execute("SELECT COUNT(*) FROM city_details;")
        city_detail_count = cur.fetchone()[0]
        print(f"✓ City Details: {city_detail_count}")
        
        cur.execute("SELECT COUNT(*) FROM collaborator_requests;")
        request_count = cur.fetchone()[0]
        print(f"✓ Collaborator Requests: {request_count}")
        
        cur.execute("SELECT COUNT(*) FROM locations;")
        location_count = cur.fetchone()[0]
        print(f"✓ Locations: {location_count}")
        
        cur.execute("SELECT COUNT(*) FROM roads;")
        road_count = cur.fetchone()[0]
        print(f"✓ Roads: {road_count}")
        
        print("\n✓ All data inserted successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Data insertion failed!")
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    insert_data()
