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
            # Check if 'month' exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='business_records' and column_name='month';
            """))
            has_month = result.fetchone() is not None

            if has_month:
                print("Renaming 'month' to 'date' and changing type to DATE...")
                # First append '-01' to the YYYY-MM string to make it a valid date YYYY-MM-DD
                conn.execute(text("UPDATE business_records SET month = month || '-01' WHERE length(month) = 7;"))
                
                # Now rename and cast
                conn.execute(text("""
                    ALTER TABLE business_records 
                    ALTER COLUMN month TYPE DATE USING month::date;
                """))
                
                conn.execute(text("""
                    ALTER TABLE business_records 
                    RENAME COLUMN month TO date;
                """))
                
                conn.commit()
                print("Successfully migrated month to date.")
            else:
                print("'month' column does not exist or already migrated.")
                
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
