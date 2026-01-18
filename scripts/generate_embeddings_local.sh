#!/bin/bash
# Standalone script to generate Quran embeddings locally
# Run this on your Mac, then sync quran.db to the VPS
#
# Usage:
#   ./scripts/generate_embeddings_local.sh [model_name]
#
# Models:
#   - all-mpnet-base-v2 (default, 400MB, best quality)
#   - paraphrase-multilingual-mpnet-base-v2 (1.1GB, best for Arabic)

set -e

# Model selection
MODEL=${1:-all-mpnet-base-v2}
echo "============================================================"
echo "Quran Embeddings Generator (Local)"
echo "Model: $MODEL"
echo "============================================================"

# Check Python version
PYTHON_CMD=$(command -v python3 || command -v python)
if [ -z "$PYTHON_CMD" ]; then
    echo "Error: Python 3 not found. Please install Python 3.9+"
    exit 1
fi

PYTHON_VERSION=$($PYTHON_CMD --version | awk '{print $2}')
echo "Using Python: $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --quiet --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install --quiet sentence-transformers numpy

# Create the Python script
cat > generate_embeddings.py << 'EOFPYTHON'
#!/usr/bin/env python3
"""Generate embeddings for Quran ayahs - standalone script."""

import sqlite3
import sys
import gc
from pathlib import Path

# Configuration
MODEL_NAME = sys.argv[1] if len(sys.argv) > 1 else "all-mpnet-base-v2"
DB_PATH = Path(__file__).parent / "quran.db"
BATCH_SIZE = 32

# Editions to embed
EDITIONS = [
    ("quran-uthmani", "ar"),
    ("en.sahih", "en"),
]

print(f"\n🔧 Loading model: {MODEL_NAME}")
print("This may take a minute on first run...")

# Load model and utilities
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer(MODEL_NAME)
print(f"✓ Model loaded (embedding dimension: {model.get_sentence_embedding_dimension()})")

def embedding_to_bytes(embedding):
    return embedding.tobytes()

def generate_embeddings_batch(texts):
    embeddings = model.encode(texts, batch_size=BATCH_SIZE, convert_to_numpy=True)
    return embeddings.astype(np.float32)

def main():
    # Check database exists
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        print("Please place quran.db in the current directory first.")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Create embeddings table
    print("\n📋 Creating embeddings table...")
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
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_embeddings_language ON ayah_embeddings(language)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_embeddings_surah ON ayah_embeddings(surah_id)")
    conn.commit()

    total_inserted = 0

    for edition_identifier, language in EDITIONS:
        print(f"\n📖 Processing {edition_identifier} ({language})...")

        # Get edition ID
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", (edition_identifier,))
        edition_row = cursor.fetchone()
        if not edition_row:
            print(f"  ⚠️ Edition {edition_identifier} not found, skipping")
            continue
        edition_id = edition_row[0]

        # Check existing
        cursor.execute("SELECT COUNT(*) FROM ayah_embeddings WHERE edition_id = ?", (edition_id,))
        existing = cursor.fetchone()[0]
        if existing > 0:
            print(f"  ℹ️ {existing} embeddings already exist, skipping")
            continue

        # Get ayahs
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
            embeddings = generate_embeddings_batch(texts)

            # Insert
            for j, row in enumerate(batch):
                embedding_bytes = embedding_to_bytes(embeddings[j])
                cursor.execute("""
                    INSERT OR REPLACE INTO ayah_embeddings
                    (ayah_id, surah_id, ayah_number, edition_id, language, embedding)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (row["id"], row["surah_id"], row["number_in_surah"],
                     edition_id, language, embedding_bytes))

            conn.commit()
            total_inserted += len(batch)
            progress = min(i + BATCH_SIZE, len(ayahs))
            pct = 100 * progress // len(ayahs)
            print(f"  Progress: {progress}/{len(ayahs)} ({pct}%)", end="\r")

            # Free memory periodically
            if progress % 500 == 0:
                gc.collect()

        print(f"\n  ✓ Completed {edition_identifier}")

    conn.close()
    print(f"\n✅ Total embeddings generated: {total_inserted}")
    print(f"\n📁 Database saved to: {DB_PATH}")
    print(f"   Size: {DB_PATH.stat().st_size / 1024 / 1024:.1f} MB")
    print(f"\n🚀 Next: Copy quran.db to your VPS at:")
    print(f"   ~/projects/islam-llm/quran-dump/quran.db")

if __name__ == "__main__":
    main()
EOFPYTHON

# Check if quran.db exists
if [ ! -f "quran.db" ]; then
    echo "⚠️  quran.db not found in current directory"
    echo "   Please copy it from: ~/projects/islam-llm/quran.db"
    echo "   Or from your VPS: scp user@vps:~/projects/islam-llm/quran.db ."
    exit 1
fi

# Run the script
echo ""
echo "Starting embedding generation..."
python3 generate_embeddings.py "$MODEL"

echo ""
echo "✅ Done! To sync to VPS:"
echo "   scp quran.db user@vps:~/projects/islam-llm/quran-dump/quran.db"
