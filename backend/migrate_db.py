import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE businesses ADD COLUMN manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
            conn.commit()
            print("Successfully added manager_id to businesses table.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column name" in str(e).lower():
                print("Column manager_id already exists.")
            else:
                print("Error during migration:", e)

if __name__ == "__main__":
    run_migration()
