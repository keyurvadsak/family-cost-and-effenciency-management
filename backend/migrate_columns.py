import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def migrate():
    if not DATABASE_URL:
        print("DATABASE_URL not set in .env")
        return

    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # PostgreSQL syntax
            conn.execute(text("ALTER TABLE businesses ADD COLUMN custom_columns JSON DEFAULT '[]'::json NOT NULL;"))
            conn.commit()
            print("Successfully added custom_columns to businesses table.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("custom_columns already exists.")
            else:
                print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
