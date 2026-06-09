import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environmental variables from .env
load_dotenv()

# Retrieve DATABASE_URL from environment or fallback to default local Postgres
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:keyur6634@localhost:5432/joint_family")

# Auto-create the target database if it doesn't exist
try:
    from urllib.parse import urlparse
    import psycopg2
    
    parsed = urlparse(DATABASE_URL)
    dbname = parsed.path.lstrip('/')
    
    # Build a connection string to the default 'postgres' database
    default_db_url = DATABASE_URL.replace(f"/{dbname}", "")
    
    conn = psycopg2.connect(default_db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{dbname}'")
    if not cursor.fetchone():
        print(f"Creating PostgreSQL database: {dbname}")
        cursor.execute(f"CREATE DATABASE {dbname}")
    
    cursor.close()
    conn.close()
except Exception as db_err:
    print("Pre-connection/database creation helper warning:", db_err)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for retrieving DB session in FastAPI path operations
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
