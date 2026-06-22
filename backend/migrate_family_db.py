import sqlite3

def migrate():
    try:
        conn = sqlite3.connect("d:\\python\\News\\HOME PROJECT\\backend\\finance.db")
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(family_members)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "manager_id" not in columns:
            cursor.execute("ALTER TABLE family_members ADD COLUMN manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL")
            conn.commit()
            print("Successfully added manager_id to family_members table.")
        else:
            print("Column manager_id already exists in family_members table.")
            
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()
