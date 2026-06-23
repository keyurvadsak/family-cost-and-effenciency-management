import sqlite3
import os

DB_PATH = "d:/python/News/HOME PROJECT/backend/finance.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS business_investments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            business_id INTEGER NOT NULL,
            person_name VARCHAR NOT NULL,
            date DATE NOT NULL,
            amount FLOAT NOT NULL,
            type VARCHAR NOT NULL,
            added_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
            FOREIGN KEY(added_by) REFERENCES users(id) ON DELETE SET NULL
        )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS ix_business_investments_id ON business_investments (id)')
        
        conn.commit()
        print("Successfully created business_investments table.")
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
