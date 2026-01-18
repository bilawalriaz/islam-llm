#!/usr/bin/env python3
"""
Migration: Create embeddings table for semantic search.

Creates a table to store pre-computed embeddings for Quran ayahs.
"""

import sqlite3
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "quran.db"


def migrate():
    """Create the ayah_embeddings table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("Creating ayah_embeddings table...")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ayah_embeddings (
            ayah_id INTEGER PRIMARY KEY,
            surah_id INTEGER NOT NULL,
            ayah_number INTEGER NOT NULL,
            edition_id INTEGER NOT NULL,
            language TEXT NOT NULL,
            embedding BLOB NOT NULL,
            FOREIGN KEY (ayah_id) REFERENCES ayahs(id)
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_embeddings_language 
        ON ayah_embeddings(language)
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_embeddings_surah 
        ON ayah_embeddings(surah_id)
    """)
    
    conn.commit()
    conn.close()
    
    print("✓ ayah_embeddings table created successfully")


if __name__ == "__main__":
    migrate()
