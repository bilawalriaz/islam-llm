#!/usr/bin/env python3
"""
Downloads the complete Quran (text + audio) from alquran.cloud API to SQLite.
"""

import asyncio
import aiohttp
import sqlite3
import argparse
from pathlib import Path

API_BASE = "https://api.alquran.cloud/v1"

# Text editions to download
TEXT_EDITIONS = [
    "quran-uthmani",      # Arabic (Uthmani script)
    "quran-simple",       # Arabic (simplified)
    "en.sahih",           # Saheeh International
    "en.pickthall",       # Pickthall
    "en.yusufali",        # Yusuf Ali
]

# Audio editions (reciters)
AUDIO_EDITIONS = [
    "ar.alafasy",
    "ar.abdulbasitmurattal",
    "ar.abdullahbasfar",
    "ar.abdurrahmaansudais",
    "ar.abdulsamad",
    "ar.shaatree",
    "ar.ahmedajamy",
    "ar.hanirifai",
    "ar.husary",
    "ar.husarymujawwad",
    "ar.hudhaify",
    "ar.ibrahimakhbar",
    "ar.mahermuaiqly",
    "ar.minshawi",
    "ar.minshawimujawwad",
    "ar.muhammadayyoub",
    "ar.muhammadjibreel",
    "ar.saoodshuraym",
    "en.walk",
    "fa.hedayatfarfooladvand",
    "ar.parhizgar",
    "ur.khan",
    "zh.chinese",
    "fr.leclerc",
    "ar.aymanswoaid",
    "ru.kuliev-audio",
    "ru.kuliev-audio-2",
]

DB_PATH = Path(__file__).parent / "quran.db"
AUDIO_DIR = Path(__file__).parent / "audio"
MAX_CONCURRENT = 1000


def create_database() -> sqlite3.Connection:
    """Create SQLite database with all tables."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Text editions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS editions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE NOT NULL,
            language TEXT,
            name TEXT,
            english_name TEXT,
            format TEXT,
            type TEXT,
            direction TEXT
        )
    """)

    # Surahs (chapters)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS surahs (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            english_name TEXT,
            english_name_translation TEXT,
            revelation_type TEXT,
            number_of_ayahs INTEGER
        )
    """)

    # Ayahs (verses) - text
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ayahs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number INTEGER NOT NULL,
            number_in_surah INTEGER NOT NULL,
            surah_id INTEGER NOT NULL,
            edition_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            juz INTEGER,
            manzil INTEGER,
            page INTEGER,
            ruku INTEGER,
            hizb_quarter INTEGER,
            sajda TEXT,
            FOREIGN KEY (surah_id) REFERENCES surahs(id),
            FOREIGN KEY (edition_id) REFERENCES editions(id),
            UNIQUE(number, edition_id)
        )
    """)

    # Audio editions (reciters)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audio_editions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            identifier TEXT UNIQUE NOT NULL,
            bitrate INTEGER
        )
    """)

    # Audio files
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audio_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ayah_number INTEGER NOT NULL,
            edition_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            url TEXT NOT NULL,
            FOREIGN KEY (edition_id) REFERENCES audio_editions(id),
            UNIQUE(ayah_number, edition_id)
        )
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ayahs_surah ON ayahs(surah_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ayahs_edition ON ayahs(edition_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ayahs_surah_edition ON ayahs(surah_id, edition_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audio_edition ON audio_files(edition_id)")

    conn.commit()
    return conn


# ============ TEXT DOWNLOAD ============

async def fetch_json(session: aiohttp.ClientSession, url: str) -> dict | None:
    """Fetch JSON from URL."""
    try:
        async with session.get(url) as response:
            if response.status == 200:
                return await response.json()
    except Exception as e:
        print(f"  Error: {e}")
    return None


async def download_text_editions(session: aiohttp.ClientSession, editions: list[str]) -> list[dict]:
    """Download all text editions in parallel."""
    tasks = []
    for ed in editions:
        url = f"{API_BASE}/quran/{ed}"
        tasks.append(fetch_json(session, url))

    print(f"  Downloading {len(editions)} editions in parallel...")
    return await asyncio.gather(*tasks)


def insert_text_data(conn: sqlite3.Connection, results: list[dict], editions: list[str]):
    """Insert text edition data into database."""
    cursor = conn.cursor()
    surahs_inserted = False

    for i, result in enumerate(results):
        edition = editions[i]

        if not result or result.get("code") != 200:
            print(f"  FAILED: {edition}")
            continue

        data = result["data"]
        surahs = data["surahs"]
        edition_info = data["edition"]

        # Insert surahs once
        if not surahs_inserted:
            for surah in surahs:
                cursor.execute("""
                    INSERT OR IGNORE INTO surahs
                    (id, name, english_name, english_name_translation, revelation_type, number_of_ayahs)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    surah["number"],
                    surah["name"],
                    surah["englishName"],
                    surah["englishNameTranslation"],
                    surah["revelationType"],
                    len(surah.get("ayahs", []))
                ))
            surahs_inserted = True

        # Insert edition
        cursor.execute("""
            INSERT OR IGNORE INTO editions
            (identifier, language, name, english_name, format, type, direction)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            edition_info.get("identifier"),
            edition_info.get("language"),
            edition_info.get("name"),
            edition_info.get("englishName"),
            edition_info.get("format"),
            edition_info.get("type"),
            edition_info.get("direction")
        ))
        conn.commit()

        cursor.execute("SELECT id FROM editions WHERE identifier = ?", (edition_info.get("identifier"),))
        edition_id = cursor.fetchone()[0]

        # Insert ayahs
        ayahs_data = []
        for surah in surahs:
            for ayah in surah["ayahs"]:
                ayahs_data.append((
                    ayah["number"],
                    ayah["numberInSurah"],
                    surah["number"],
                    edition_id,
                    ayah["text"],
                    ayah.get("juz"),
                    ayah.get("manzil"),
                    ayah.get("page"),
                    ayah.get("ruku"),
                    ayah.get("hizbQuarter"),
                    str(ayah.get("sajda")) if ayah.get("sajda") else None
                ))

        cursor.executemany("""
            INSERT OR REPLACE INTO ayahs
            (number, number_in_surah, surah_id, edition_id, text, juz, manzil, page, ruku, hizb_quarter, sajda)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ayahs_data)
        conn.commit()

        print(f"  OK: {edition} ({len(ayahs_data)} ayahs)")


# ============ AUDIO DOWNLOAD ============

async def download_file(session: aiohttp.ClientSession, url: str, file_path: Path, semaphore: asyncio.Semaphore) -> bool:
    """Download a single audio file."""
    if file_path.exists() and file_path.stat().st_size > 0:
        return True

    file_path.parent.mkdir(parents=True, exist_ok=True)

    for attempt in range(3):
        async with semaphore:
            try:
                async with session.get(url) as response:
                    if response.status == 200:
                        content = await response.read()
                        file_path.write_bytes(content)
                        return True
                    elif response.status == 429:
                        await asyncio.sleep(2 ** attempt)
            except (aiohttp.ClientError, asyncio.TimeoutError):
                await asyncio.sleep(0.5 * (attempt + 1))
    return False


async def download_audio_edition(
    session: aiohttp.ClientSession,
    conn: sqlite3.Connection,
    edition: str,
    semaphore: asyncio.Semaphore
) -> tuple[int, int]:
    """Download all audio for one edition."""

    # Fetch edition data to get audio URLs
    data = await fetch_json(session, f"{API_BASE}/quran/{edition}")
    if not data or data.get("code") != 200:
        return 0, 0

    # Extract audio URLs and bitrate
    audio_urls = []
    bitrate = 128
    for surah in data["data"]["surahs"]:
        for ayah in surah["ayahs"]:
            url = ayah.get("audio")
            if url:
                audio_urls.append((ayah["number"], url))
                if bitrate == 128 and "/audio/" in url:
                    parts = url.split("/audio/")[1].split("/")
                    if parts[0].isdigit():
                        bitrate = int(parts[0])

    if not audio_urls:
        return 0, 0

    print(f"  {len(audio_urls)} files at {bitrate}kbps")

    # Check existing
    edition_dir = AUDIO_DIR / edition
    if edition_dir.exists():
        existing = len([f for f in edition_dir.glob("*.mp3") if f.stat().st_size > 0])
        if existing == len(audio_urls):
            print(f"  Already complete")
            return existing, 0

    # Download files
    tasks = []
    for ayah_num, url in audio_urls:
        file_path = edition_dir / f"{ayah_num}.mp3"
        tasks.append(download_file(session, url, file_path, semaphore))

    success = 0
    batch_size = 1000
    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i + batch_size]
        results = await asyncio.gather(*batch, return_exceptions=True)
        batch_success = sum(1 for r in results if r is True)
        success += batch_success
        print(f"\r  {i + len(batch)}/{len(tasks)} ({success} OK)", end="", flush=True)

    failed = len(tasks) - success
    print(f"\r  {success} downloaded, {failed} failed" + " " * 20)

    # Save metadata
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO audio_editions (identifier, bitrate) VALUES (?, ?)", (edition, bitrate))
    conn.commit()
    cursor.execute("SELECT id FROM audio_editions WHERE identifier = ?", (edition,))
    edition_id = cursor.fetchone()[0]

    records = []
    for ayah_num, url in audio_urls:
        file_path = edition_dir / f"{ayah_num}.mp3"
        if file_path.exists() and file_path.stat().st_size > 0:
            records.append((ayah_num, edition_id, str(file_path), url))

    cursor.executemany("""
        INSERT OR REPLACE INTO audio_files (ayah_number, edition_id, file_path, url)
        VALUES (?, ?, ?, ?)
    """, records)
    conn.commit()

    return success, failed


# ============ MAIN ============

async def main(skip_text: bool = False, skip_audio: bool = False):
    print("=" * 60)
    print("Quran Database Downloader")
    print("=" * 60)
    print(f"Database: {DB_PATH}")
    print(f"Audio directory: {AUDIO_DIR}")
    print()

    conn = create_database()
    AUDIO_DIR.mkdir(exist_ok=True)

    timeout = aiohttp.ClientTimeout(total=120, connect=30)
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT, limit_per_host=MAX_CONCURRENT)

    async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:

        # Download text
        if not skip_text:
            print(f"[1/2] DOWNLOADING TEXT ({len(TEXT_EDITIONS)} editions)")
            print("-" * 40)
            results = await download_text_editions(session, TEXT_EDITIONS)
            insert_text_data(conn, results, TEXT_EDITIONS)
            print()

        # Download audio
        if not skip_audio:
            print(f"[2/2] DOWNLOADING AUDIO ({len(AUDIO_EDITIONS)} reciters)")
            print("-" * 40)
            semaphore = asyncio.Semaphore(MAX_CONCURRENT)

            total_success = 0
            total_failed = 0

            for i, edition in enumerate(AUDIO_EDITIONS):
                print(f"\n[{i + 1}/{len(AUDIO_EDITIONS)}] {edition}")
                success, failed = await download_audio_edition(session, conn, edition, semaphore)
                total_success += success
                total_failed += failed

            print(f"\nAudio totals: {total_success} downloaded, {total_failed} failed")

    conn.close()

    # Final stats
    print()
    print("=" * 60)
    print("DOWNLOAD COMPLETE")
    print("=" * 60)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM surahs")
    print(f"Surahs: {cursor.fetchone()[0]}")

    cursor.execute("SELECT COUNT(*) FROM editions")
    print(f"Text editions: {cursor.fetchone()[0]}")

    cursor.execute("SELECT COUNT(*) FROM ayahs")
    print(f"Text ayahs: {cursor.fetchone()[0]:,}")

    cursor.execute("SELECT COUNT(*) FROM audio_editions")
    print(f"Audio editions: {cursor.fetchone()[0]}")

    cursor.execute("SELECT COUNT(*) FROM audio_files")
    print(f"Audio files in DB: {cursor.fetchone()[0]:,}")

    conn.close()

    if AUDIO_DIR.exists():
        total_files = sum(1 for _ in AUDIO_DIR.rglob("*.mp3"))
        total_size = sum(f.stat().st_size for f in AUDIO_DIR.rglob("*.mp3"))
        print(f"Audio files on disk: {total_files:,}")
        print(f"Audio size: {total_size / (1024**3):.2f} GB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download Quran text and audio")
    parser.add_argument("--skip-text", action="store_true", help="Skip text download")
    parser.add_argument("--skip-audio", action="store_true", help="Skip audio download")
    parser.add_argument("--concurrency", type=int, default=100, help="Max concurrent downloads")
    args = parser.parse_args()

    MAX_CONCURRENT = args.concurrency
    asyncio.run(main(skip_text=args.skip_text, skip_audio=args.skip_audio))
