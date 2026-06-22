import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        try:
            # Check if column exists
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='family_members' AND column_name='manager_id';"
            )).fetchone()
            
            if not result:
                conn.execute(text("ALTER TABLE family_members ADD COLUMN manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
                print("Successfully added manager_id to family_members table.")
            else:
                print("Column manager_id already exists in family_members table.")
        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
