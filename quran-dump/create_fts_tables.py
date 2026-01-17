#!/usr/bin/env python3
"""
SQLite FTS5 Migration Script for Quran Database

Creates full-text search virtual tables for Arabic and English Quran text,
with support for diacritic-insensitive Arabic search.

Usage:
    python3 create_fts_tables.py
"""

import sqlite3
import re
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "quran.db"

# Arabic diacritics (harakat/tashkeel) ranges
ARABIC_DIACRITICS = re.compile(r'[\u064B-\u065F\u0670\u0640]')


def remove_arabic_diacritics(text: str) -> str:
    """Remove Arabic diacritics (tashkeel) from text."""
    return ARABIC_DIACRITICS.sub('', text)


def create_fts_tables(conn):
    """Create FTS5 virtual tables for Arabic and English search."""
    cursor = conn.cursor()

    print("Creating FTS5 virtual tables...")

    # Drop existing FTS tables if they exist (for re-running)
    cursor.execute("DROP TABLE IF EXISTS fts_arabic")
    cursor.execute("DROP TABLE IF EXISTS fts_english")

    # Create Arabic FTS table with normalized text column
    # We add text_normalized which has diacritics removed
    cursor.execute("""
        CREATE VIRTUAL TABLE fts_arabic USING fts5(
            ayah_id,
            ayah_number,
            surah_id,
            number_in_surah,
            text,
            text_normalized,
            edition_id,
            tokenize = 'porter unicode61'
        )
    """)

    # Create English FTS table
    cursor.execute("""
        CREATE VIRTUAL TABLE fts_english USING fts5(
            ayah_id,
            ayah_number,
            surah_id,
            number_in_surah,
            text,
            edition_id,
            tokenize = 'porter unicode61'
        )
    """)

    print("FTS5 tables created successfully.")
    return cursor


def populate_fts_tables(cursor):
    """Populate FTS tables with existing ayah data."""
    print("Populating FTS tables with existing data...")

    # Get all ayahs with edition info
    cursor.execute("""
        SELECT a.id, a.number, a.surah_id, a.number_in_surah, a.text, a.edition_id, e.language
        FROM ayahs a
        JOIN editions e ON a.edition_id = e.id
        ORDER BY e.language, a.edition_id, a.id
    """)

    all_ayahs = cursor.fetchall()
    print(f"Processing {len(all_ayahs)} ayahs...")

    arabic_count = 0
    english_count = 0

    for ayah_id, ayah_number, surah_id, number_in_surah, text, edition_id, language in all_ayahs:
        if language == 'ar':
            # For Arabic, add normalized text without diacritics
            text_normalized = remove_arabic_diacritics(text)
            cursor.execute("""
                INSERT INTO fts_arabic (ayah_id, ayah_number, surah_id, number_in_surah, text, text_normalized, edition_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ayah_id, ayah_number, surah_id, number_in_surah, text, text_normalized, edition_id))
            arabic_count += 1
        elif language == 'en':
            cursor.execute("""
                INSERT INTO fts_english (ayah_id, ayah_number, surah_id, number_in_surah, text, edition_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (ayah_id, ayah_number, surah_id, number_in_surah, text, edition_id))
            english_count += 1

    print(f"  Added {arabic_count} Arabic ayahs to FTS")
    print(f"  Added {english_count} English ayahs to FTS")


def create_triggers(cursor):
    """Create triggers to keep FTS tables in sync with ayahs table."""
    print("Creating triggers for FTS synchronization...")

    # Drop existing triggers if they exist
    for trigger in [
        "ayahs_insert_arabic", "ayahs_delete_arabic", "ayahs_update_arabic",
        "ayahs_insert_english", "ayahs_delete_english", "ayahs_update_english"
    ]:
        cursor.execute(f"DROP TRIGGER IF EXISTS {trigger}")

    # Arabic triggers - we need a helper function for diacritic removal
    # Since SQLite triggers can't call Python, we'll use a simpler approach
    # and handle normalization in the application layer for updates
    cursor.execute("""
        CREATE TRIGGER ayahs_insert_arabic AFTER INSERT ON ayahs
        WHEN NEW.edition_id IN (SELECT id FROM editions WHERE language = 'ar')
        BEGIN
            INSERT INTO fts_arabic (ayah_id, ayah_number, surah_id, number_in_surah, text, text_normalized, edition_id)
            VALUES (NEW.id, NEW.number, NEW.surah_id, NEW.number_in_surah, NEW.text, NEW.text, NEW.edition_id);
        END
    """)

    cursor.execute("""
        CREATE TRIGGER ayahs_delete_arabic AFTER DELETE ON ayahs
        WHEN OLD.edition_id IN (SELECT id FROM editions WHERE language = 'ar')
        BEGIN
            DELETE FROM fts_arabic WHERE ayah_id = OLD.id;
        END
    """)

    cursor.execute("""
        CREATE TRIGGER ayahs_update_arabic AFTER UPDATE ON ayahs
        WHEN NEW.edition_id IN (SELECT id FROM editions WHERE language = 'ar')
        BEGIN
            UPDATE fts_arabic
            SET text = NEW.text, text_normalized = NEW.text
            WHERE ayah_id = NEW.id;
        END
    """)

    # English triggers
    cursor.execute("""
        CREATE TRIGGER ayahs_insert_english AFTER INSERT ON ayahs
        WHEN NEW.edition_id IN (SELECT id FROM editions WHERE language = 'en')
        BEGIN
            INSERT INTO fts_english (ayah_id, ayah_number, surah_id, number_in_surah, text, edition_id)
            VALUES (NEW.id, NEW.number, NEW.surah_id, NEW.number_in_surah, NEW.text, NEW.edition_id);
        END
    """)

    cursor.execute("""
        CREATE TRIGGER ayahs_delete_english AFTER DELETE ON ayahs
        WHEN OLD.edition_id IN (SELECT id FROM editions WHERE language = 'en')
        BEGIN
            DELETE FROM fts_english WHERE ayah_id = OLD.id;
        END
    """)

    cursor.execute("""
        CREATE TRIGGER ayahs_update_english AFTER UPDATE ON ayahs
        WHEN NEW.edition_id IN (SELECT id FROM editions WHERE language = 'en')
        BEGIN
            UPDATE fts_english
            SET text = NEW.text
            WHERE ayah_id = NEW.id;
        END
    """)

    print("Triggers created successfully.")


def verify_fts_tables(cursor):
    """Verify FTS tables are working correctly."""
    print("\nVerifying FTS tables...")

    # Check row counts
    cursor.execute("SELECT COUNT(*) FROM fts_arabic")
    arabic_count = cursor.fetchone()[0]
    print(f"Arabic FTS table: {arabic_count} rows")

    cursor.execute("SELECT COUNT(*) FROM fts_english")
    english_count = cursor.fetchone()[0]
    print(f"English FTS table: {english_count} rows")

    # Test Arabic search with normalized column
    print("\nTesting Arabic search (diacritic-insensitive):")

    # Remove diacritics from search query
    test_queries = [
        (remove_arabic_diacritics("بسم الله"), "Search without diacritics"),
        (remove_arabic_diacritics("الرحمن"), "Search for الرحمن"),
        (remove_arabic_diacritics("رحمن"), "Partial match"),
    ]

    for query, description in test_queries:
        cursor.execute("""
            SELECT f.text, s.name, f.number_in_surah
            FROM fts_arabic f
            JOIN surahs s ON f.surah_id = s.id
            WHERE fts_arabic MATCH ?
            LIMIT 1
        """, (query,))
        result = cursor.fetchone()
        if result:
            print(f"  ✓ {description}: Found in {result[1]}:{result[2]}")
        else:
            print(f"  ✗ {description}: No results")

    # Test English search
    print("\nTesting English search:")
    test_queries_en = [
        ("mercy", "Search for 'mercy'"),
        ("merciful", "Search for 'merciful'"),
        ("gracious", "Search for 'gracious'"),
    ]

    for query, description in test_queries_en:
        cursor.execute("""
            SELECT f.text, s.english_name, f.number_in_surah
            FROM fts_english f
            JOIN surahs s ON f.surah_id = s.id
            WHERE fts_english MATCH ?
            LIMIT 1
        """, (query,))
        result = cursor.fetchone()
        if result:
            print(f"  ✓ {description}: Found in {result[1]}:{result[2]}")
        else:
            print(f"  ✗ {description}: No results")


def main():
    """Main migration function."""
    print("=" * 60)
    print("SQLite FTS5 Migration for Quran Database")
    print("=" * 60)

    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return 1

    conn = sqlite3.connect(DB_PATH)
    try:
        # Create FTS tables
        create_fts_tables(conn)

        # Populate with existing data
        populate_fts_tables(conn.cursor())

        # Create triggers for future sync
        create_triggers(conn.cursor())

        # Commit changes
        conn.commit()

        # Verify
        verify_fts_tables(conn.cursor())

        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"Error during migration: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    exit(main())
