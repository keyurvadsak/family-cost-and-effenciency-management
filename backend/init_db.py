import os
from dotenv import load_dotenv
from urllib.parse import urlparse
import psycopg2

def init_database():
    # Load environmental variables from .env
    load_dotenv()
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not found in .env")
        return
        
    try:
        parsed = urlparse(database_url)
        dbname = parsed.path.lstrip('/')
        
        # Build a connection string to the default 'postgres' database
        default_db_url = database_url.replace(f"/{dbname}", "")
        
        conn = psycopg2.connect(default_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{dbname}'")
        if not cursor.fetchone():
            print(f"Creating PostgreSQL database: {dbname}")
            cursor.execute(f"CREATE DATABASE {dbname}")
        else:
            print(f"Database {dbname} already exists.")
        
        cursor.close()
        conn.close()
        
        # Now create tables
        from database import engine, Base
        import models  # Ensure models are imported so Base metadata is populated
        
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("Database initialization complete.")
        
    except Exception as db_err:
        print("Database initialization error:", db_err)

if __name__ == "__main__":
    init_database()
