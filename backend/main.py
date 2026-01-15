"""
Quran Reader API - Backend Server

FastAPI server that serves Quran data from SQLite database
and provides audio file streaming with user authentication,
bookmarks, and progress tracking.
"""

from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import os
import hashlib
import secrets
import json
from datetime import datetime, timedelta
from pathlib import Path
from share_image import generate_ayah_image_bytes

# Database path
DB_PATH = Path(__file__).parent.parent / "quran-dump" / "quran.db"
AUDIO_PATH = Path(__file__).parent.parent / "quran-dump" / "audio"
TOKEN_EXPIRY_DAYS = 30

app = FastAPI(title="Quran Reader API")

# CORS middleware - allows localhost and Tailscale access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://100.115.245.7:5173",
        "http://100.115.245.7:3000",
        "http://100.115.245.7:8001",  # Tailscale backend direct
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve audio files as static files
if AUDIO_PATH.exists():
    app.mount("/audio", StaticFiles(directory=str(AUDIO_PATH)), name="audio")


def get_db_connection():
    """Create a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    """Hash a password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_token(authorization: str = Header(None)) -> Optional[int]:
    """Verify authorization token and return user_id."""
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:]  # Remove "Bearer " prefix

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id, expires_at
            FROM session_tokens
            WHERE token = ?
        """, (token,))
        row = cursor.fetchone()

        if not row:
            return None

        # Check if token is expired
        if row["expires_at"]:
            expires_at = datetime.fromisoformat(row["expires_at"])
            if expires_at < datetime.now():
                return None

        return row["user_id"]
    finally:
        conn.close()


def get_current_user(user_id: int = Depends(verify_token)):
    """Get current user from token."""
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, created_at FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return dict(user)
    finally:
        conn.close()


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "database": "connected" if DB_PATH.exists() else "not found"}


# =============================================================================
# QURAN API ENDPOINTS
# =============================================================================

@app.get("/api/quran/surahs")
def get_surahs():
    """Get all surahs (chapters)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, english_name, english_name_translation,
                   revelation_type, number_of_ayahs
            FROM surahs
            ORDER BY id ASC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/quran/surahs/{surah_id}")
def get_surah(surah_id: int, edition: str = Query("quran-uthmani")):
    """Get a single surah by ID."""
    conn = get_db_connection()
    try:
        # First get the edition ID
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", (edition,))
        edition_row = cursor.fetchone()
        if not edition_row:
            raise HTTPException(status_code=404, detail=f"Edition '{edition}' not found")
        edition_id = edition_row[0]

        # Get surah info
        cursor.execute("""
            SELECT id, name, english_name, english_name_translation,
                   revelation_type, number_of_ayahs
            FROM surahs
            WHERE id = ?
        """, (surah_id,))
        surah = cursor.fetchone()
        if not surah:
            raise HTTPException(status_code=404, detail=f"Surah {surah_id} not found")

        return dict(surah)
    finally:
        conn.close()


@app.get("/api/quran/surahs/{surah_id}/ayahs")
def get_ayahs(surah_id: int, edition: str = Query("quran-uthmani")):
    """Get all ayahs for a specific surah."""
    conn = get_db_connection()
    try:
        # Get edition ID
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", (edition,))
        edition_row = cursor.fetchone()
        if not edition_row:
            raise HTTPException(status_code=404, detail=f"Edition '{edition}' not found")
        edition_id = edition_row[0]

        # Get ayahs
        cursor.execute("""
            SELECT a.id, a.number, a.number_in_surah, a.text,
                   a.juz, a.manzil, a.page, a.ruku, a.hizb_quarter, a.sajda
            FROM ayahs a
            WHERE a.surah_id = ? AND a.edition_id = ?
            ORDER BY a.number_in_surah ASC
        """, (surah_id, edition_id))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/quran/editions")
def get_editions():
    """Get all available text editions."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT identifier, language, name, english_name, format, type, direction
            FROM editions
            ORDER BY language, type, english_name
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/quran/audio/editions")
def get_audio_editions():
    """Get all available audio editions (reciters)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, identifier, bitrate
            FROM audio_editions
            ORDER BY identifier
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/quran/audio/{ayah_number}")
def get_ayah_audio(ayah_number: int, edition: str = Query("ar.alafasy")):
    """Get audio file info for a specific ayah."""
    conn = get_db_connection()
    try:
        # Get audio edition ID
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM audio_editions WHERE identifier = ?", (edition,))
        edition_row = cursor.fetchone()
        if not edition_row:
            raise HTTPException(status_code=404, detail=f"Audio edition '{edition}' not found")
        edition_id = edition_row[0]

        # Get audio file info
        cursor.execute("""
            SELECT file_path, url
            FROM audio_files
            WHERE ayah_number = ? AND edition_id = ?
        """, (ayah_number, edition_id))
        row = cursor.fetchone()
        if not row:
            # If not in database, construct the path from standard structure
            audio_file = AUDIO_PATH / edition / f"{ayah_number}.mp3"
            if audio_file.exists():
                return {
                    "ayah_number": ayah_number,
                    "edition": edition,
                    "url": f"/api/audio/{edition}/{ayah_number}.mp3",
                    "file_path": str(audio_file)
                }
            raise HTTPException(status_code=404, detail=f"Audio for ayah {ayah_number} not found")

        return {
            "ayah_number": ayah_number,
            "edition": edition,
            "url": f"/api/audio/{edition}/{ayah_number}.mp3",
            "file_path": row["file_path"]
        }
    finally:
        conn.close()


# =============================================================================
# AUTH ENDPOINTS
# =============================================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


@app.post("/api/auth/register")
def register(data: RegisterRequest):
    """Register a new user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (data.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create new user
        password_hash = hash_password(data.password)
        cursor.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        """, (data.name, data.email, password_hash))
        conn.commit()

        user_id = cursor.lastrowid

        return {"user": {"id": user_id, "name": data.name, "email": data.email}}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already registered")
    finally:
        conn.close()


@app.post("/api/auth/login")
def login(data: LoginRequest):
    """Login user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        password_hash = hash_password(data.password)

        # Find user
        cursor.execute("""
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = ?
        """, (data.email,))
        user = cursor.fetchone()

        if not user or user["password_hash"] != password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Create session token
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now() + timedelta(days=TOKEN_EXPIRY_DAYS)).isoformat()

        cursor.execute("""
            INSERT INTO session_tokens (user_id, token, expires_at)
            VALUES (?, ?, ?)
        """, (user["id"], token, expires_at))
        conn.commit()

        return {
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
            "session_token": token
        }
    finally:
        conn.close()


@app.post("/api/auth/logout")
def logout(authorization: str = Header(None)):
    """Logout user."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"success": True}

    token = authorization[7:]
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM session_tokens WHERE token = ?", (token,))
        conn.commit()
        return {"success": True}
    finally:
        conn.close()


@app.get("/api/auth/me")
def get_current_user_endpoint(current_user: dict = Depends(get_current_user)):
    """Get current user."""
    return {"user": current_user}


# =============================================================================
# BOOKMARKS ENDPOINTS
# =============================================================================

class BookmarkRequest(BaseModel):
    ayah_id: int
    surah_id: int
    ayah_number_in_surah: int


@app.get("/api/bookmarks")
def get_bookmarks(current_user: dict = Depends(get_current_user)):
    """Get all bookmarks for the current user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Get edition ID for Arabic text (Uthmani)
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", ("quran-uthmani",))
        edition_row = cursor.fetchone()
        edition_id = edition_row[0] if edition_row else 1

        cursor.execute("""
            SELECT b.id, b.ayah_id, b.surah_id, b.ayah_number_in_surah,
                   b.created_at,
                   s.name as surah_name, s.english_name, s.english_name_translation,
                   s.revelation_type, s.number_of_ayahs,
                   a.text as ayah_text
            FROM bookmarks b
            JOIN surahs s ON b.surah_id = s.id
            LEFT JOIN ayahs a ON a.id = b.ayah_id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        """, (current_user["id"],))
        bookmarks = cursor.fetchall()
        return [dict(row) for row in bookmarks]
    finally:
        conn.close()


@app.post("/api/bookmarks")
def create_bookmark(
    data: BookmarkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new bookmark."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO bookmarks (user_id, ayah_id, surah_id, ayah_number_in_surah)
            VALUES (?, ?, ?, ?)
        """, (current_user["id"], data.ayah_id, data.surah_id, data.ayah_number_in_surah))
        conn.commit()
        return {"success": True, "id": cursor.lastrowid}
    except sqlite3.IntegrityError:
        # Already bookmarked
        return {"success": True, "id": -1}
    finally:
        conn.close()


@app.delete("/api/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: int, current_user: dict = Depends(get_current_user)):
    """Delete a bookmark."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM bookmarks
            WHERE id = ? AND user_id = ?
        """, (bookmark_id, current_user["id"]))
        conn.commit()
        return {"success": True}
    finally:
        conn.close()


@app.get("/api/bookmarks/exists/{ayah_id}")
def check_bookmark(ayah_id: int, current_user: dict = Depends(get_current_user)):
    """Check if an ayah is bookmarked."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id FROM bookmarks
            WHERE user_id = ? AND ayah_id = ?
        """, (current_user["id"], ayah_id))
        result = cursor.fetchone()
        return {"bookmarked": result is not None, "bookmark_id": result["id"] if result else None}
    finally:
        conn.close()

@app.get("/api/bookmarks/surah/{surah_id}")
def get_bookmarks_for_surah(surah_id: int, current_user: dict = Depends(get_current_user)):
    """Get all bookmarks for a specific surah (batch endpoint). Returns map of ayah_id -> bookmark_id."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ayah_id, id
            FROM bookmarks
            WHERE user_id = ? AND surah_id = ?
        """, (current_user["id"], surah_id))
        results = cursor.fetchall()
        return {row["ayah_id"]: row["id"] for row in results}
    finally:
        conn.close()


# =============================================================================
# PROGRESS TRACKING ENDPOINTS
# =============================================================================

class ProgressUpdateRequest(BaseModel):
    surah_id: int
    ayah_id: int
    ayah_number: int


@app.post("/api/progress")
def update_progress(
    data: ProgressUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update reading progress for a surah."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check if progress exists for this surah
        cursor.execute("""
            SELECT id, last_read_ayah_id, total_ayahs_read
            FROM reading_progress
            WHERE user_id = ? AND surah_id = ?
        """, (current_user["id"], data.surah_id))
        existing = cursor.fetchone()

        today = datetime.now().strftime("%Y-%m-%d")

        if existing:
            # Update existing progress
            cursor.execute("""
                UPDATE reading_progress
                SET last_read_ayah_id = ?,
                    last_read_ayah_number = ?,
                    last_read_date = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND surah_id = ?
            """, (data.ayah_id, data.ayah_number, today, current_user["id"], data.surah_id))

            # Track daily reading (increment if reading a different ayah)
            if existing["last_read_ayah_id"] != data.ayah_id:
                cursor.execute("""
                    INSERT INTO daily_readings (user_id, read_date, ayahs_read)
                    VALUES (?, ?, 1)
                    ON CONFLICT(user_id, read_date)
                    DO UPDATE SET ayahs_read = ayahs_read + 1
                """, (current_user["id"], today))

            conn.commit()
        else:
            # Create new progress record
            cursor.execute("""
                INSERT INTO reading_progress
                (user_id, surah_id, last_read_ayah_id, last_read_ayah_number, total_ayahs_read, last_read_date)
                VALUES (?, ?, ?, ?, 1, ?)
            """, (current_user["id"], data.surah_id, data.ayah_id, data.ayah_number, today))

            # Track daily reading
            cursor.execute("""
                INSERT INTO daily_readings (user_id, read_date, ayahs_read)
                VALUES (?, ?, 1)
                ON CONFLICT(user_id, read_date)
                DO UPDATE SET ayahs_read = ayahs_read + 1
            """, (current_user["id"], today))

            conn.commit()

        return {"success": True}
    finally:
        conn.close()


@app.get("/api/progress")
def get_progress(current_user: dict = Depends(get_current_user)):
    """Get all reading progress for the current user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT rp.surah_id, rp.last_read_ayah_id, rp.last_read_ayah_number,
                   rp.total_ayahs_read, rp.last_read_date, rp.updated_at,
                   s.name as surah_name, s.english_name, s.number_of_ayahs
            FROM reading_progress rp
            JOIN surahs s ON rp.surah_id = s.id
            WHERE rp.user_id = ?
            ORDER BY rp.updated_at DESC
        """, (current_user["id"],))
        progress = cursor.fetchall()
        return [dict(row) for row in progress]
    finally:
        conn.close()


@app.get("/api/progress/stats")
def get_progress_stats(current_user: dict = Depends(get_current_user)):
    """Get reading statistics for the current user."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Total unique ayahs read - sum from daily readings
        cursor.execute("""
            SELECT COALESCE(SUM(ayahs_read), 0) as total_ayahs
            FROM daily_readings
            WHERE user_id = ?
        """, (current_user["id"],))
        total_ayahs = cursor.fetchone()["total_ayahs"] or 0

        # Total surahs with progress
        cursor.execute("""
            SELECT COUNT(DISTINCT surah_id) as total_surahs
            FROM reading_progress
            WHERE user_id = ?
        """, (current_user["id"],))
        total_surahs = cursor.fetchone()["total_surahs"] or 0

        # Total bookmarks
        cursor.execute("""
            SELECT COUNT(*) as total_bookmarks
            FROM bookmarks
            WHERE user_id = ?
        """, (current_user["id"],))
        total_bookmarks = cursor.fetchone()["total_bookmarks"] or 0

        # Calculate reading streak
        cursor.execute("""
            SELECT read_date
            FROM daily_readings
            WHERE user_id = ?
            ORDER BY read_date DESC
            LIMIT 365
        """, (current_user["id"],))
        daily_readings = cursor.fetchall()

        streak = 0
        if daily_readings:
            # Get unique dates
            dates = [r["read_date"] for r in daily_readings]
            unique_dates = sorted(list(set(dates)), reverse=True)

            today = datetime.now().strftime("%Y-%m-%d")
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

            # Start streak if we have reading for today or yesterday
            if unique_dates and (unique_dates[0] == today or unique_dates[0] == yesterday):
                streak = 1
                # Count consecutive days going backwards
                expected_date = (datetime.now() - timedelta(days=1 if unique_dates[0] == today else 2)).strftime("%Y-%m-%d")

                for date in unique_dates[1:]:
                    if date == expected_date:
                        streak += 1
                        # Move to previous day
                        expected_date = (datetime.strptime(expected_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
                    else:
                        break

        return {
            "total_ayahs_read": total_ayahs,
            "total_surahs_read": total_surahs,
            "total_bookmarks": total_bookmarks,
            "reading_streak": streak
        }
    finally:
        conn.close()


@app.get("/api/progress/last-position")
def get_last_position(current_user: dict = Depends(get_current_user)):
    """Get the last reading position for resuming."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT rp.surah_id, rp.last_read_ayah_id, rp.last_read_ayah_number,
                   rp.last_read_date,
                   s.name as surah_name, s.english_name, s.number_of_ayahs
            FROM reading_progress rp
            JOIN surahs s ON rp.surah_id = s.id
            WHERE rp.user_id = ?
            ORDER BY rp.updated_at DESC
            LIMIT 1
        """, (current_user["id"],))
        position = cursor.fetchone()

        if not position:
            return None

        return dict(position)
    finally:
        conn.close()


# =============================================================================
# COMPLETION TRACKING ENDPOINTS
# =============================================================================

class CompleteAyahRequest(BaseModel):
    ayah_id: int
    surah_id: int
    ayah_number: int


@app.post("/api/completed-ayahs")
def mark_ayah_completed(
    data: CompleteAyahRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark an ayah as completed (when audio finishes)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO completed_ayahs (user_id, ayah_id, surah_id, ayah_number)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, ayah_id) DO NOTHING
        """, (current_user["id"], data.ayah_id, data.surah_id, data.ayah_number))
        conn.commit()
        return {"success": True}
    finally:
        conn.close()


@app.get("/api/completed-ayahs/surah/{surah_id}")
def get_completed_ayahs_for_surah(
    surah_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get list of completed ayah IDs for a specific surah."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ayah_id, ayah_number, completed_at
            FROM completed_ayahs
            WHERE user_id = ? AND surah_id = ?
            ORDER BY ayah_number ASC
        """, (current_user["id"], surah_id))
        completed = cursor.fetchall()
        return [dict(row) for row in completed]
    finally:
        conn.close()


@app.get("/api/completed-ayahs/stats/{surah_id}")
def get_surah_completion_stats(
    surah_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get completion stats for a specific surah."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Get total ayahs in surah
        cursor.execute("""
            SELECT number_of_ayahs
            FROM surahs
            WHERE id = ?
        """, (surah_id,))
        surah = cursor.fetchone()
        if not surah:
            raise HTTPException(status_code=404, detail="Surah not found")

        total_ayahs = surah["number_of_ayahs"]

        # Get completed count
        cursor.execute("""
            SELECT COUNT(*) as completed_count
            FROM completed_ayahs
            WHERE user_id = ? AND surah_id = ?
        """, (current_user["id"], surah_id))
        completed_count = cursor.fetchone()["completed_count"]

        # Get first unread ayah
        cursor.execute("""
            SELECT MIN(a.number_in_surah) as first_unread
            FROM ayahs a
            LEFT JOIN completed_ayahs ca ON ca.ayah_id = a.id AND ca.user_id = ?
            WHERE a.surah_id = ? AND ca.ayah_id IS NULL
        """, (current_user["id"], surah_id))
        first_unread = cursor.fetchone()["first_unread"]

        # Get list of completed ayah numbers
        cursor.execute("""
            SELECT ayah_number
            FROM completed_ayahs
            WHERE user_id = ? AND surah_id = ?
            ORDER BY ayah_number ASC
        """, (current_user["id"], surah_id))
        completed_numbers = [row["ayah_number"] for row in cursor.fetchall()]

        return {
            "total_ayahs": total_ayahs,
            "completed_count": completed_count,
            "completion_percentage": round((completed_count / total_ayahs) * 100, 1) if total_ayahs > 0 else 0,
            "first_unread_ayah": first_unread,
            "completed_ayah_numbers": completed_numbers
        }
    finally:
        conn.close()


@app.get("/api/completed-ayahs/first-unread")
def get_first_unread_ayah(current_user: dict = Depends(get_current_user)):
    """Get the first unread ayah across all surahs (for global resume)."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Find the first surah with any progress that has unread ayahs
        cursor.execute("""
            SELECT rp.surah_id, s.name as surah_name, s.english_name, s.number_of_ayahs,
                   MIN(a.number_in_surah) as first_unread_ayah
            FROM reading_progress rp
            JOIN surahs s ON s.id = rp.surah_id
            JOIN ayahs a ON a.surah_id = rp.surah_id
            LEFT JOIN completed_ayahs ca ON ca.ayah_id = a.id AND ca.user_id = rp.user_id
            WHERE rp.user_id = ? AND ca.ayah_id IS NULL
            GROUP BY rp.surah_id
            ORDER BY rp.updated_at DESC
            LIMIT 1
        """, (current_user["id"],))
        result = cursor.fetchone()

        if not result:
            return None

        return dict(result)
    finally:
        conn.close()


@app.get("/api/completed-ayahs/overall-stats")
def get_overall_completion_stats(current_user: dict = Depends(get_current_user)):
    """Get overall completion statistics across all surahs."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Total ayahs in Quran
        total_quran_ayahs = 6236

        # Get completed ayahs count
        cursor.execute("""
            SELECT COUNT(*) as completed_count
            FROM completed_ayahs
            WHERE user_id = ?
        """, (current_user["id"],))
        completed_count = cursor.fetchone()["completed_count"]

        # Get completed surahs (100% complete)
        cursor.execute("""
            SELECT COUNT(*) as completed_surahs
            FROM (
                SELECT surah_id, COUNT(*) as completed
                FROM completed_ayahs
                WHERE user_id = ?
                GROUP BY surah_id
                JOIN surahs s ON s.id = surah_id
                WHERE completed >= s.number_of_ayahs
            )
        """, (current_user["id"],))

        # Alternative query for completed surahs
        cursor.execute("""
            SELECT COUNT(DISTINCT ca.surah_id) as completed_surahs
            FROM completed_ayahs ca
            JOIN surahs s ON s.id = ca.surah_id
            WHERE ca.user_id = ?
            GROUP BY ca.surah_id
            HAVING COUNT(*) >= s.number_of_ayahs
        """, (current_user["id"],))
        completed_surahs_result = cursor.fetchone()
        completed_surahs = completed_surahs_result["completed_surahs"] if completed_surahs_result else 0

        return {
            "total_ayahs_in_quran": total_quran_ayahs,
            "ayahs_completed": completed_count,
            "completion_percentage": round((completed_count / total_quran_ayahs) * 100, 1),
            "surahs_fully_completed": completed_surahs
        }
    finally:
        conn.close()


# =============================================================================
# SHARE IMAGE ENDPOINTS
# =============================================================================

@app.get("/api/share/ayah/{surah_id}/{ayah_number}")
def get_ayah_share_image(
    surah_id: int,
    ayah_number: int,
    edition: str = Query("quran-uthmani", description="Arabic text edition"),
    translation: str = Query("en.sahih", description="Translation edition"),
    square: bool = Query(False, description="Generate square image for Instagram"),
    portrait: bool = Query(False, description="Generate 9:16 portrait for mobile stories"),
    format: str = Query("png", description="Image format (png or jpeg)")
):
    """
    Generate a beautiful, artistic shareable image for an ayah.

    Returns an optimized image suitable for sharing on social media platforms.
    Supports: landscape (default), square (Instagram), portrait (WhatsApp/Snapchat stories)
    """
    conn = get_db_connection()
    try:
        # Get surah info
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, english_name, english_name_translation, number_of_ayahs
            FROM surahs
            WHERE id = ?
        """, (surah_id,))
        surah = cursor.fetchone()

        if not surah:
            raise HTTPException(status_code=404, detail=f"Surah {surah_id} not found")

        # Get edition ID for Arabic text
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", (edition,))
        edition_row = cursor.fetchone()
        if not edition_row:
            raise HTTPException(status_code=404, detail=f"Edition '{edition}' not found")
        edition_id = edition_row[0]

        # Get ayah text
        cursor.execute("""
            SELECT text, number_in_surah
            FROM ayahs
            WHERE surah_id = ? AND edition_id = ? AND number_in_surah = ?
        """, (surah_id, edition_id, ayah_number))
        ayah = cursor.fetchone()

        if not ayah:
            raise HTTPException(
                status_code=404,
                detail=f"Ayah {ayah_number} not found in Surah {surah_id}"
            )

        # Get translation if requested
        translation_text = None
        if translation != "none":
            cursor.execute("SELECT id FROM editions WHERE identifier = ?", (translation,))
            trans_row = cursor.fetchone()
            if trans_row:
                trans_edition_id = trans_row[0]
                cursor.execute("""
                    SELECT text
                    FROM ayahs
                    WHERE surah_id = ? AND edition_id = ? AND number_in_surah = ?
                """, (surah_id, trans_edition_id, ayah_number))
                trans_ayah = cursor.fetchone()
                if trans_ayah:
                    translation_text = trans_ayah["text"]

        # Generate image
        image_format = format.upper() if format.lower() in ["png", "jpeg", "jpg"] else "PNG"
        image_bytes = generate_ayah_image_bytes(
            arabic_text=ayah["text"],
            translation_text=translation_text or "",
            surah_name=surah["name"],
            surah_number=surah_id,
            ayah_number=ayah_number,
            surah_english_name=surah["english_name"],
            edition_name=edition,
            square=square,
            portrait=portrait,
            format=image_format
        )

        # Return image with appropriate headers
        media_type = "image/jpeg" if image_format == "JPEG" else "image/png"
        filename = f"surah-{surah_id}-ayah-{ayah_number}.{format.lower()}"

        return Response(
            content=image_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",  # No caching for fresh images
            }
        )

    finally:
        conn.close()


@app.get("/api/share/ayah/by-id/{ayah_id}")
def get_ayah_share_image_by_id(
    ayah_id: int,
    translation: str = Query("en.sahih", description="Translation edition"),
    square: bool = Query(False, description="Generate square image for Instagram"),
    format: str = Query("png", description="Image format (png or jpeg)")
):
    """
    Generate a shareable image using ayah ID instead of surah/number.

    Alternative endpoint that works directly with ayah IDs.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Get ayah with surah info
        cursor.execute("""
            SELECT a.text, a.number_in_surah, a.surah_id,
                   s.name, s.english_name
            FROM ayahs a
            JOIN surahs s ON s.id = a.surah_id
            WHERE a.id = ?
        """, (ayah_id,))
        result = cursor.fetchone()

        if not result:
            raise HTTPException(status_code=404, detail=f"Ayah ID {ayah_id} not found")

        # Get translation if requested
        translation_text = None
        if translation != "none":
            cursor.execute("SELECT id FROM editions WHERE identifier = ?", (translation,))
            trans_row = cursor.fetchone()
            if trans_row:
                trans_edition_id = trans_row[0]
                cursor.execute("""
                    SELECT text
                    FROM ayahs
                    WHERE id = ? AND edition_id = ?
                """, (ayah_id, trans_edition_id))
                trans_result = cursor.fetchone()
                if trans_result:
                    translation_text = trans_result["text"]

        # Generate image
        image_format = format.upper() if format.lower() in ["png", "jpeg", "jpg"] else "PNG"
        image_bytes = generate_ayah_image_bytes(
            arabic_text=result["text"],
            translation_text=translation_text or "",
            surah_name=result["name"],
            surah_number=result["surah_id"],
            ayah_number=result["number_in_surah"],
            edition_name="",
            square=square,
            format=image_format
        )

        media_type = "image/jpeg" if image_format == "JPEG" else "image/png"
        filename = f"ayah-{ayah_id}.{format.lower()}"

        return Response(
            content=image_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )

    finally:
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
