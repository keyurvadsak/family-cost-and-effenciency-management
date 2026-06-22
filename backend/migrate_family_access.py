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
            # Check if allowed_user_ids column exists
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='family_members' AND column_name='allowed_user_ids';"
            )).fetchone()
            
            if not result:
                conn.execute(text("ALTER TABLE family_members ADD COLUMN allowed_user_ids JSON DEFAULT '[]'::json;"))
                print("Successfully added allowed_user_ids to family_members table.")
            else:
                print("Column allowed_user_ids already exists.")
                
            # Drop manager_id column if exists
            result_mgr = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='family_members' AND column_name='manager_id';"
            )).fetchone()
            
            if result_mgr:
                conn.execute(text("ALTER TABLE family_members DROP COLUMN manager_id;"))
                print("Successfully dropped manager_id from family_members table.")
            else:
                print("Column manager_id does not exist.")

        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
