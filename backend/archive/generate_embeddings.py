#!/usr/bin/env python3
"""
Generate embeddings for all Quran ayahs.

This script generates semantic embeddings for:
- Uthmani Arabic text (quran-uthmani)
- Saheeh International English translation (en.sahih)

Uses all-MiniLM-L6-v2 model (~80MB, English-optimized but works for search).
"""

import sqlite3
import sys
import gc
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from embeddings import generate_embeddings_batch, embedding_to_bytes

# Database path
DB_PATH = Path(__file__).parent.parent.parent / "quran.db"

# Editions to embed
EDITIONS = [
    ("quran-uthmani", "ar"),
    ("en.sahih", "en"),
]

BATCH_SIZE = 32


def generate_all_embeddings():
    """Generate and store embeddings for all ayahs."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # First run the table migration
    from create_embeddings_table import migrate
    migrate()
    
    total_inserted = 0
    
    for edition_identifier, language in EDITIONS:
        print(f"\nProcessing {edition_identifier} ({language})...")
        
        # Get edition ID
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", (edition_identifier,))
        edition_row = cursor.fetchone()
        if not edition_row:
            print(f"  ✗ Edition {edition_identifier} not found, skipping")
            continue
        edition_id = edition_row[0]
        
        # Check if already embedded
        cursor.execute("""
            SELECT COUNT(*) FROM ayah_embeddings 
            WHERE edition_id = ?
        """, (edition_id,))
        existing_count = cursor.fetchone()[0]
        
        if existing_count > 0:
            print(f"  ℹ {existing_count} embeddings already exist for this edition, skipping")
            continue
        
        # Get all ayahs for this edition
        cursor.execute("""
            SELECT id, number, surah_id, number_in_surah, text
            FROM ayahs
            WHERE edition_id = ?
            ORDER BY number
        """, (edition_id,))
        ayahs = cursor.fetchall()
        
        print(f"  Found {len(ayahs)} ayahs to embed")
        
        # Process in batches
        for i in range(0, len(ayahs), BATCH_SIZE):
            batch = ayahs[i:i + BATCH_SIZE]
            texts = [row["text"] for row in batch]
            
            # Generate embeddings
            embeddings = generate_embeddings_batch(texts, batch_size=BATCH_SIZE)
            
            # Insert into database
            for j, row in enumerate(batch):
                embedding_bytes = embedding_to_bytes(embeddings[j])
                cursor.execute("""
                    INSERT OR REPLACE INTO ayah_embeddings 
                    (ayah_id, surah_id, ayah_number, edition_id, language, embedding)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    row["id"],
                    row["surah_id"],
                    row["number_in_surah"],
                    edition_id,
                    language,
                    embedding_bytes
                ))

            # Commit every batch to free memory
            conn.commit()

            total_inserted += len(batch)
            progress = min(i + BATCH_SIZE, len(ayahs))
            print(f"  Progress: {progress}/{len(ayahs)} ({100*progress//len(ayahs)}%)")

            # Free memory periodically
            if progress % 500 == 0:
                gc.collect()

        print(f"  ✓ Completed {edition_identifier}")
    
    conn.close()
    print(f"\n✓ Total embeddings generated: {total_inserted}")


if __name__ == "__main__":
    print("=" * 60)
    print("Quran Embeddings Generator")
    print("Model: all-MiniLM-L6-v2")
    print("=" * 60)
    generate_all_embeddings()
