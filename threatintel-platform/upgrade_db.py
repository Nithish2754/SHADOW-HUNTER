import sqlite3

def upgrade_db():
    conn = sqlite3.connect('shadow_hunter.db')
    c = conn.cursor()
    columns_to_add = {
        'severity': 'VARCHAR(20) DEFAULT "LOW"',
        'status': 'VARCHAR(20) DEFAULT "NEW"',
        'page_title': 'VARCHAR',
        'verified_by': 'VARCHAR(100)',
        'notes': 'TEXT'
    }
    
    # Check existing columns
    c.execute("PRAGMA table_info(keyword_hits)")
    existing_cols = [row[1] for row in c.fetchall()]
    
    for col, definition in columns_to_add.items():
        if col not in existing_cols:
            print(f"Adding column {col}...")
            c.execute(f"ALTER TABLE keyword_hits ADD COLUMN {col} {definition}")
            
    conn.commit()
    conn.close()
    print("Database upgrade complete.")

if __name__ == '__main__':
    upgrade_db()
