"""
Quran Reader API - Backend Server

FastAPI server that serves Quran data from SQLite database
and provides audio file streaming with user authentication via Supabase,
bookmarks, and progress tracking.
"""

# Load environment variables from .env file FIRST
from dotenv import load_dotenv
load_dotenv()

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

# Supabase integration
from supabase import create_client, Client

# Database paths
DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).parent.parent / "quran-dump" / "quran.db"))
AUDIO_PATH = Path(os.environ.get("AUDIO_PATH", Path(__file__).parent.parent / "quran-dump" / "audio"))

# Supabase configuration
SUPABASE_URL = "https://zxmyoojcuihavbhiblwc.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4bXlvb2pjdWloYXZiaGlibHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDMwODAsImV4cCI6MjA4NDA3OTA4MH0.WTrrU42RBAW1rIxukNsVDYZ5ifYMiuQe_nlpEPgkjsM")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"DEBUG: SUPABASE_SERVICE_ROLE_KEY loaded: {bool(SUPABASE_SERVICE_ROLE_KEY)}")
if SUPABASE_SERVICE_ROLE_KEY:
    print(f"DEBUG: Service key length: {len(SUPABASE_SERVICE_ROLE_KEY)}")
    print(f"DEBUG: Service key starts with: {SUPABASE_SERVICE_ROLE_KEY[:20]}...")
else:
    print("DEBUG: Service role key NOT found in environment!")

# Create Supabase client for public operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Create Supabase client with service role key for admin operations (bypasses RLS)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else None
print(f"DEBUG: supabase_admin client created: {supabase_admin is not None}")

app = FastAPI(title="Quran Reader API")

# =============================================================================
# PRELOAD EMBEDDINGS MODEL
# =============================================================================
# With gunicorn --preload, this loads the model in the parent process before
# forking workers, enabling copy-on-write memory sharing. This reduces RAM
# usage from ~2GB (4 workers x 420MB) to ~500MB total.
# =============================================================================
print("Preloading embeddings model...")
try:
    from embeddings import get_model
    _ = get_model()
    print("✓ Embeddings model loaded and ready")
except Exception as e:
    print(f"⚠ Failed to preload embeddings model: {e}")

# CORS middleware - allows localhost, Tailscale, and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://100.115.245.7:5173",
        "http://100.115.245.7:3000",
        "http://100.115.245.7:8001",  # Tailscale backend direct
        "https://quran.hyperflash.uk",  # Production CF tunnel
        "http://quran.hyperflash.uk",   # Development/testing
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve audio files as static files
if AUDIO_PATH.exists():
    app.mount("/audio", StaticFiles(directory=str(AUDIO_PATH)), name="audio")


def get_db_connection():
    """Create a database connection for Quran data."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


async def verify_token(authorization: str = Header(None)) -> Optional[str]:
    """Verify Supabase JWT token and return user_id (UUID)."""
    if not authorization:
        print("DEBUG: verify_token - No authorization header")
        return None

    if not authorization.startswith("Bearer "):
        print("DEBUG: verify_token - Invalid authorization format")
        return None

    token = authorization[7:]  # Remove "Bearer " prefix
    print(f"DEBUG: verify_token - Token length: {len(token)}, starts with: {token[:20]}...")

    try:
        # Verify the JWT token with Supabase
        print("DEBUG: verify_token - Calling supabase.auth.get_user()...")
        user = supabase.auth.get_user(token)
        print(f"DEBUG: verify_token - Supabase response: {user}")

        if user and user.user:
            print(f"DEBUG: verify_token - SUCCESS: user_id={user.user.id}")
            return user.user.id
        print("DEBUG: verify_token - FAILED: No user in response")
        return None
    except Exception as e:
        print(f"DEBUG: verify_token - Exception: {e}")
        return None


async def get_current_user_with_token(authorization: str = Header(None)):
    """Get current user profile AND return the access token for password updates."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")

    token = authorization[7:]  # Remove "Bearer " prefix

    try:
        # Verify the JWT token with Supabase
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = user.user.id

        # Get user profile
        response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()

        if not response.data:
            raise HTTPException(status_code=401, detail="User not found")

        return {
            "id": response.data["id"],
            "name": response.data.get("name", ""),
            "email": response.data.get("email", ""),
            "created_at": response.data.get("created_at", ""),
            "access_token": token
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"User not found: {str(e)}")


async def get_current_user(user_id: str = Depends(verify_token)):
    """Get current user profile from Supabase."""
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    try:
        # Use admin client for profile fetching to bypass RLS
        client = supabase_admin if supabase_admin else supabase
        response = client.table("profiles").select("*").eq("id", user_id).single().execute()

        if not response.data:
            raise HTTPException(status_code=401, detail="User not found")

        return {
            "id": response.data["id"],
            "name": response.data.get("name", ""),
            "email": response.data.get("email", ""),
            "created_at": response.data.get("created_at", "")
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"User not found: {str(e)}")


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


@app.get("/api/quran/search")
def search_quran(
    q: str = Query(..., description="Search query text", min_length=1),
    language: Optional[str] = Query(None, description="Filter by language: ar, en, or all (default: auto-detect)"),
    surah_id: Optional[int] = Query(None, description="Filter to specific surah"),
    limit: int = Query(50, description="Max results (default: 50, max: 200)", ge=1, le=200),
    offset: int = Query(0, description="Pagination offset", ge=0)
):
    """
    Full-text search across Quran ayahs using FTS5.

    Searches Uthmani Arabic text and Saheeh International English translation.
    Auto-detects query language if not specified.
    """
    import re

    # Arabic diacritics pattern
    ARABIC_DIACRITICS = re.compile(r'[\u064B-\u065F\u0670\u0640]')

    def remove_arabic_diacritics(text: str) -> str:
        return ARABIC_DIACRITICS.sub('', text)

    def detect_language(query: str) -> str:
        """Detect if query is Arabic or English based on character range."""
        arabic_chars = sum(1 for c in query if '\u0600' <= c <= '\u06ff')
        return 'ar' if arabic_chars > len(query) * 0.3 else 'en'

    # Auto-detect language if not specified
    if language is None:
        language = detect_language(q)

    # Normalize limit
    limit = min(limit, 200)

    # Normalize Arabic query (remove diacritics)
    normalized_query = remove_arabic_diacritics(q) if language == 'ar' else q

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        results = []
        total_count = 0

        # Get edition IDs for fixed editions
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", ('quran-uthmani',))
        uthmani_row = cursor.fetchone()
        uthmani_id = uthmani_row[0] if uthmani_row else None

        cursor.execute("SELECT id FROM editions WHERE identifier = ?", ('en.sahih',))
        saheeh_row = cursor.fetchone()
        saheeh_id = saheeh_row[0] if saheeh_row else None

        # Build the search query based on language
        if language == 'ar':
            # Arabic search from Uthmani only
            where_clause = "WHERE fts_arabic MATCH ? AND e.identifier = 'quran-uthmani'"
            params = [normalized_query]

            if surah_id:
                where_clause += " AND f.surah_id = ?"
                params.append(surah_id)

            # Get total count
            count_sql = f"SELECT COUNT(*) FROM fts_arabic f JOIN editions e ON f.edition_id = e.id {where_clause}"
            cursor.execute(count_sql, params)
            total_count = cursor.fetchone()[0]

            # Get results with pagination
            sql = f"""
                SELECT
                    f.ayah_id,
                    f.ayah_number,
                    f.surah_id,
                    f.number_in_surah,
                    f.text,
                    f.edition_id,
                    e.identifier as edition_identifier,
                    e.language,
                    s.name as surah_name,
                    s.english_name as surah_english_name,
                    s.english_name_translation
                FROM fts_arabic f
                JOIN editions e ON f.edition_id = e.id
                JOIN surahs s ON f.surah_id = s.id
                {where_clause}
                ORDER BY f.ayah_number
                LIMIT ? OFFSET ?
            """
            cursor.execute(sql, params + [limit, offset])
            rows = cursor.fetchall()

            for row in rows:
                highlighted = highlight_match(row["text"], normalized_query, language='ar')
                results.append({
                    "ayah_number": row["ayah_number"],
                    "surah_id": row["surah_id"],
                    "number_in_surah": row["number_in_surah"],
                    "surah_name": get_row_value(row, "surah_name"),
                    "surah_english_name": get_row_value(row, "surah_english_name"),
                    "surah_english_name_translation": get_row_value(row, "surah_english_name_translation"),
                    "text": row["text"],
                    "highlighted_text": highlighted,
                    "edition": row["edition_identifier"],
                    "language": row["language"]
                })

        elif language == 'en':
            # English search from Saheeh International only
            where_clause = "WHERE fts_english MATCH ? AND e.identifier = 'en.sahih'"
            params = [normalized_query]

            if surah_id:
                where_clause += " AND f.surah_id = ?"
                params.append(surah_id)

            # Get total count
            count_sql = f"SELECT COUNT(*) FROM fts_english f JOIN editions e ON f.edition_id = e.id {where_clause}"
            cursor.execute(count_sql, params)
            total_count = cursor.fetchone()[0]

            # Get results with pagination
            sql = f"""
                SELECT
                    f.ayah_id,
                    f.ayah_number,
                    f.surah_id,
                    f.number_in_surah,
                    f.text,
                    f.edition_id,
                    e.identifier as edition_identifier,
                    e.language,
                    e.name as edition_name,
                    s.name as surah_name,
                    s.english_name as surah_english_name,
                    s.english_name_translation
                FROM fts_english f
                JOIN editions e ON f.edition_id = e.id
                JOIN surahs s ON f.surah_id = s.id
                {where_clause}
                ORDER BY f.ayah_number
                LIMIT ? OFFSET ?
            """
            cursor.execute(sql, params + [limit, offset])
            rows = cursor.fetchall()

            for row in rows:
                highlighted = highlight_match(row["text"], normalized_query, language='en')
                results.append({
                    "ayah_number": row["ayah_number"],
                    "surah_id": row["surah_id"],
                    "number_in_surah": row["number_in_surah"],
                    "surah_name": get_row_value(row, "surah_name"),
                    "surah_english_name": get_row_value(row, "surah_english_name"),
                    "surah_english_name_translation": get_row_value(row, "surah_english_name_translation"),
                    "text": row["text"],
                    "highlighted_text": highlighted,
                    "edition": row["edition_identifier"],
                    "edition_name": get_row_value(row, "edition_name"),
                    "language": row["language"]
                })

        else:  # language == 'all' - search both Uthmani and Saheeh
            # Arabic results from Uthmani
            arabic_where = "WHERE fts_arabic MATCH ? AND e.identifier = 'quran-uthmani'"
            arabic_params = [normalized_query]

            if surah_id:
                arabic_where += " AND f.surah_id = ?"
                arabic_params.append(surah_id)

            arabic_sql = f"""
                SELECT
                    f.ayah_id,
                    f.ayah_number,
                    f.surah_id,
                    f.number_in_surah,
                    f.text,
                    f.edition_id,
                    e.identifier as edition_identifier,
                    e.language,
                    s.name as surah_name,
                    s.english_name as surah_english_name,
                    s.english_name_translation
                FROM fts_arabic f
                JOIN editions e ON f.edition_id = e.id
                JOIN surahs s ON f.surah_id = s.id
                {arabic_where}
                ORDER BY f.ayah_number
                LIMIT ?
            """
            cursor.execute(arabic_sql, arabic_params + [limit])
            arabic_rows = cursor.fetchall()

            for row in arabic_rows:
                highlighted = highlight_match(row["text"], normalized_query, language='ar')
                results.append({
                    "ayah_number": row["ayah_number"],
                    "surah_id": row["surah_id"],
                    "number_in_surah": row["number_in_surah"],
                    "surah_name": get_row_value(row, "surah_name"),
                    "surah_english_name": get_row_value(row, "surah_english_name"),
                    "surah_english_name_translation": get_row_value(row, "surah_english_name_translation"),
                    "text": row["text"],
                    "highlighted_text": highlighted,
                    "edition": row["edition_identifier"],
                    "language": row["language"]
                })

            # English results from Saheeh
            remaining = limit - len(results)
            if remaining > 0:
                english_where = "WHERE fts_english MATCH ? AND e.identifier = 'en.sahih'"
                english_params = [normalized_query]

                if surah_id:
                    english_where += " AND f.surah_id = ?"
                    english_params.append(surah_id)

                english_sql = f"""
                    SELECT
                        f.ayah_id,
                        f.ayah_number,
                        f.surah_id,
                        f.number_in_surah,
                        f.text,
                        f.edition_id,
                        e.identifier as edition_identifier,
                        e.language,
                        e.name as edition_name,
                        s.name as surah_name,
                        s.english_name as surah_english_name,
                        s.english_name_translation
                    FROM fts_english f
                    JOIN editions e ON f.edition_id = e.id
                    JOIN surahs s ON f.surah_id = s.id
                    {english_where}
                    ORDER BY f.ayah_number
                    LIMIT ?
                """
                cursor.execute(english_sql, english_params + [remaining])
                english_rows = cursor.fetchall()

                for row in english_rows:
                    highlighted = highlight_match(row["text"], normalized_query, language='en')
                    results.append({
                        "ayah_number": row["ayah_number"],
                        "surah_id": row["surah_id"],
                        "number_in_surah": row["number_in_surah"],
                        "surah_name": get_row_value(row, "surah_name"),
                        "surah_english_name": get_row_value(row, "surah_english_name"),
                        "surah_english_name_translation": get_row_value(row, "surah_english_name_translation"),
                        "text": row["text"],
                        "highlighted_text": highlighted,
                        "edition": row["edition_identifier"],
                        "edition_name": get_row_value(row, "edition_name"),
                        "language": row["language"]
                    })

            total_count = len(results)

        return {
            "query": q,
            "language": language,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "results": results
        }

    finally:
        conn.close()


def get_row_value(row, key, default=""):
    """Safely get a value from a sqlite3.Row object with a default."""
    try:
        value = row[key]
        return value if value is not None else default
    except (KeyError, IndexError):
        return default


def highlight_match(text: str, query: str, language: str = 'en') -> str:
    """
    Highlight matching terms in the text.

    For now, returns the original text.
    A more sophisticated implementation would use FTS5's highlight function
    or implement custom highlighting in Python.
    """
    # TODO: Implement proper highlighting using FTS5 snippet/bm25highlight functions
    # or regex-based matching for search terms
    return text




# =============================================================================
# AUTH ENDPOINTS (Supabase)
# =============================================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


@app.post("/api/auth/register")
async def register(data: RegisterRequest):
    """Register a new user using Supabase Auth."""
    try:
        # Create user in Supabase Auth
        response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "name": data.name
                }
            }
        })

        if not response.user:
            raise HTTPException(status_code=400, detail="Failed to create user")

        return {
            "user": {
                "id": response.user.id,
                "name": data.name,
                "email": data.email
            },
            "session": {
                "access_token": response.session.access_token if response.session else None,
                "refresh_token": response.session.refresh_token if response.session else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")


@app.post("/api/auth/login")
async def login(data: LoginRequest):
    """Login user using Supabase Auth."""
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })

        if not response.user or not response.session:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Get user profile for name
        profile_response = supabase.table("profiles").select("name").eq("id", response.user.id).single().execute()

        return {
            "user": {
                "id": response.user.id,
                "name": profile_response.data.get("name", "") if profile_response.data else "",
                "email": response.user.email
            },
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token
            }
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")


@app.post("/api/auth/logout")
async def logout():
    """Logout user - client should discard tokens."""
    # With Supabase, token management is primarily client-side
    # The client should discard the access_token and refresh_token
    return {"success": True}


@app.get("/api/auth/me")
async def get_current_user_endpoint(current_user: dict = Depends(get_current_user)):
    """Get current user."""
    return {"user": current_user}


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    access_token: str
    new_password: str


@app.post("/api/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send password reset email via Supabase."""
    try:
        # Use Supabase's built-in password reset
        # The redirect URL is where users land after clicking the email link
        supabase.auth.reset_password_for_email(
            data.email,
            options={
                "redirect_to": "https://quran.hyperflash.uk/reset-password"
            }
        )
        # Always return success to prevent email enumeration
        return {"success": True, "message": "If an account exists with this email, a reset link has been sent."}
    except Exception as e:
        # Log error but don't expose details to client
        print(f"Password reset error: {e}")
        return {"success": True, "message": "If an account exists with this email, a reset link has been sent."}


@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    """Update password using recovery access token from email link."""
    try:
        # Create a new client authenticated with the recovery token
        # This allows us to update the user's password
        from supabase import create_client
        
        # Create authenticated client with the access token
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Set the session with the access token from the recovery email
        auth_client.auth.set_session(data.access_token, data.access_token)
        
        # Update the user's password
        response = auth_client.auth.update_user({
            "password": data.new_password
        })
        
        if response.user:
            return {"success": True, "message": "Password has been reset successfully."}
        else:
            raise HTTPException(status_code=400, detail="Failed to reset password")
    except Exception as e:
        print(f"Password reset error: {e}")
        raise HTTPException(status_code=400, detail="Failed to reset password. The link may have expired.")


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None  # Optional for Google users setting password for first time
    new_password: str


@app.post("/api/auth/change-password")
async def change_password(data: ChangePasswordRequest, current_user: dict = Depends(get_current_user_with_token)):
    """
    Change password for an authenticated user.

    For users who signed up with email/password:
    - Requires current password to verify

    For Google OAuth users:
    - Can set a password without current password (leave it empty)
    - Allows signing in with either Google OR email/password afterward
    """
    try:
        access_token = current_user.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="No session token available")

        # Verify current password if provided (for users with existing passwords)
        if data.current_password:
            try:
                # Try to sign in with the current password to verify it
                verify_response = supabase.auth.sign_in_with_password({
                    "email": current_user["email"],
                    "password": data.current_password
                })
            except Exception:
                raise HTTPException(status_code=400, detail="Current password is incorrect")

        # Update the user's password using their access token
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        auth_client.auth.set_session(access_token, access_token)

        update_response = auth_client.auth.update_user({
            "password": data.new_password
        })

        if update_response.user:
            return {
                "success": True,
                "message": "Password updated successfully. You can now sign in with your email and password."
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to update password")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Change password error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Failed to change password: {str(e)}")


class OAuthCallbackRequest(BaseModel):
    provider: str
    access_token: str
    refresh_token: Optional[str] = None


@app.post("/api/auth/oauth/callback")
async def oauth_callback(data: OAuthCallbackRequest):
    """
    Exchange OAuth tokens for a Supabase session.

    Handles account merging:
    - If user's email already exists from a previous email/password registration,
      the Google OAuth identity is linked to the existing account.
    - All existing data (bookmarks, progress, etc.) is preserved.
    """
    try:
        print(f"OAuth callback received: provider={data.provider}, has_access_token={bool(data.access_token)}, has_refresh_token={bool(data.refresh_token)}")

        if data.provider != "google":
            raise HTTPException(status_code=400, detail="Unsupported provider")

        # Create a new Supabase client and set session with OAuth tokens
        from supabase import create_client
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Set the session using the OAuth tokens
        print("Setting session with OAuth tokens...")
        auth_client.auth.set_session(data.access_token, data.refresh_token)

        # Get the user to verify the session is valid
        print("Getting user from Supabase...")
        user_response = auth_client.auth.get_user()
        print(f"User response: {user_response}")

        if not user_response or not user_response.user:
            print("ERROR: Invalid OAuth tokens - no user returned")
            raise HTTPException(status_code=401, detail="Invalid OAuth tokens")

        oauth_user_id = user_response.user.id
        oauth_email = user_response.user.email
        print(f"OAuth user: id={oauth_user_id}, email={oauth_email}")

        # Use admin client for profile operations (bypasses RLS)
        profile_client = supabase_admin if supabase_admin else supabase

        # Check if there's an existing profile with this email (from email/password registration)
        existing_profile = profile_client.table("profiles").select("*").eq("email", oauth_email).execute()

        # Get or create profile for the OAuth user
        oauth_profile = profile_client.table("profiles").select("*").eq("id", oauth_user_id).execute()

        user_name = ""
        user_email = oauth_email

        # Handle account merging scenario
        if existing_profile.data and len(existing_profile.data) > 0:
            existing = existing_profile.data[0]
            existing_user_id = existing["id"]

            # If different user IDs, we have a duplicate - merge the accounts
            if existing_user_id != oauth_user_id:
                print(f"Account merge needed: existing={existing_user_id}, oauth={oauth_user_id}, email={oauth_email}")

                # Check if OAuth profile already exists (might be created by Supabase)
                if oauth_profile.data and len(oauth_profile.data) > 0:
                    # OAuth profile exists, migrate data from old profile to new one
                    await _migrate_account_data(existing_user_id, oauth_user_id, profile_client)

                    # Update OAuth profile with existing data (preserve name, etc.)
                    profile_client.table("profiles").update({
                        "name": existing.get("name", ""),
                        "updated_at": datetime.now().isoformat()
                    }).eq("id", oauth_user_id).execute()

                    user_name = existing.get("name", "")
                    user_email = existing.get("email", oauth_email)

                    # Optionally delete or mark old profile as merged
                    # For now, we'll keep it but could add a 'merged_to' field
                    print(f"Account merged: {existing_user_id} -> {oauth_user_id}")
                else:
                    # OAuth profile doesn't exist, create it with existing data
                    new_profile = {
                        "id": oauth_user_id,
                        "email": oauth_email,
                        "name": existing.get("name", ""),
                        "created_at": datetime.now().isoformat()
                    }
                    profile_client.table("profiles").insert(new_profile).execute()

                    # Migrate data from old account to new OAuth account
                    await _migrate_account_data(existing_user_id, oauth_user_id, profile_client)

                    user_name = existing.get("name", "")
                    user_email = oauth_email

                    print(f"Account migrated and merged: {existing_user_id} -> {oauth_user_id}")
            else:
                # Same user ID, no merge needed
                user_name = existing.get("name", "")
                user_email = existing.get("email", oauth_email)

        elif oauth_profile.data and len(oauth_profile.data) > 0:
            # OAuth profile exists, no duplicate
            user_name = oauth_profile.data[0].get("name", "")
            user_email = oauth_profile.data[0].get("email", oauth_email)
        else:
            # No profile exists yet, create one
            user_metadata_name = user_response.user.user_metadata.get("name", "") or user_response.user.user_metadata.get("full_name", "")
            new_profile = {
                "id": oauth_user_id,
                "email": oauth_email,
                "name": user_metadata_name,
                "created_at": datetime.now().isoformat()
            }
            print(f"Creating new profile: {new_profile}")
            profile_client.table("profiles").insert(new_profile).execute()
            user_name = new_profile["name"]

        print(f"OAuth callback successful: user_id={oauth_user_id}, email={user_email}, name={user_name}")

        return {
            "user": {
                "id": oauth_user_id,
                "name": user_name,
                "email": user_email
            },
            "session": {
                "access_token": data.access_token,
                "refresh_token": data.refresh_token
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"OAuth callback error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail="OAuth authentication failed")


async def _migrate_account_data(from_user_id: str, to_user_id: str, client: Client = None):
    """
    Migrate all user data from one account to another during account merge.

    Tables to migrate:
    - bookmarks
    - reading_progress
    - daily_readings
    - completed_ayahs
    - play_sessions
    - replay_stats
    - quran_play_sessions
    """
    # Use admin client if provided, otherwise use default client
    migration_client = client if client else supabase

    # Migrate bookmarks
    existing_bookmarks = migration_client.table("bookmarks").select("*").eq("user_id", from_user_id).execute()
    if existing_bookmarks.data:
        for bm in existing_bookmarks.data:
            try:
                migration_client.table("bookmarks").insert({
                    "user_id": to_user_id,
                    "ayah_id": bm["ayah_id"],
                    "surah_id": bm["surah_id"],
                    "ayah_number_in_surah": bm["ayah_number_in_surah"],
                    "created_at": bm["created_at"]
                }).execute()
            except Exception:
                pass  # Duplicate bookmarks are ok

    # Migrate reading_progress
    existing_progress = migration_client.table("reading_progress").select("*").eq("user_id", from_user_id).execute()
    if existing_progress.data:
        for p in existing_progress.data:
            try:
                migration_client.table("reading_progress").insert({
                    "user_id": to_user_id,
                    "surah_id": p["surah_id"],
                    "last_read_ayah_id": p["last_read_ayah_id"],
                    "last_read_ayah_number": p["last_read_ayah_number"],
                    "total_ayahs_read": p["total_ayahs_read"],
                    "last_read_date": p["last_read_date"],
                    "created_at": p.get("created_at"),
                    "updated_at": p["updated_at"]
                }).execute()
            except Exception:
                pass

    # Migrate daily_readings
    existing_daily = migration_client.table("daily_readings").select("*").eq("user_id", from_user_id).execute()
    if existing_daily.data:
        for d in existing_daily.data:
            try:
                migration_client.table("daily_readings").insert({
                    "user_id": to_user_id,
                    "read_date": d["read_date"],
                    "ayahs_read": d["ayahs_read"]
                }).execute()
            except Exception:
                pass

    # Migrate completed_ayahs
    existing_completed = migration_client.table("completed_ayahs").select("*").eq("user_id", from_user_id).execute()
    if existing_completed.data:
        for c in existing_completed.data:
            try:
                migration_client.table("completed_ayahs").insert({
                    "user_id": to_user_id,
                    "ayah_id": c["ayah_id"],
                    "surah_id": c["surah_id"],
                    "ayah_number": c["ayah_number"],
                    "is_sequential": c.get("is_sequential", False),
                    "completed_at": c["completed_at"]
                }).execute()
            except Exception:
                pass

    # Migrate play_sessions
    existing_sessions = migration_client.table("play_sessions").select("*").eq("user_id", from_user_id).execute()
    if existing_sessions.data:
        for s in existing_sessions.data:
            try:
                migration_client.table("play_sessions").insert({
                    "user_id": to_user_id,
                    "ayah_id": s["ayah_id"],
                    "surah_id": s["surah_id"],
                    "ayah_number": s["ayah_number"],
                    "audio_edition": s.get("audio_edition", "ar.alafasy"),
                    "created_at": s["created_at"],
                    "completed_at": s.get("completed_at"),
                    "duration_seconds": s.get("duration_seconds")
                }).execute()
            except Exception:
                pass

    # Migrate replay_stats
    existing_replay = migration_client.table("replay_stats").select("*").eq("user_id", from_user_id).execute()
    if existing_replay.data:
        for r in existing_replay.data:
            try:
                migration_client.table("replay_stats").insert({
                    "user_id": to_user_id,
                    "ayah_id": r["ayah_id"],
                    "play_count": r["play_count"],
                    "total_duration_seconds": r["total_duration_seconds"],
                    "last_played_at": r["last_played_at"]
                }).execute()
            except Exception:
                pass

    # Migrate quran_play_sessions
    existing_quran_sessions = migration_client.table("quran_play_sessions").select("*").eq("user_id", from_user_id).execute()
    if existing_quran_sessions.data:
        for qs in existing_quran_sessions.data:
            try:
                migration_client.table("quran_play_sessions").insert({
                    "user_id": to_user_id,
                    "start_surah_id": qs["start_surah_id"],
                    "start_ayah_number": qs["start_ayah_number"],
                    "created_at": qs["created_at"],
                    "ended_at": qs.get("ended_at")
                }).execute()
            except Exception:
                pass


# =============================================================================
# BOOKMARKS ENDPOINTS (Supabase + SQLite)
# =============================================================================

class BookmarkRequest(BaseModel):
    ayah_id: int
    surah_id: int
    ayah_number_in_surah: int


@app.get("/api/bookmarks")
async def get_bookmarks(current_user: dict = Depends(get_current_user)):
    """Get all bookmarks for the current user. Optimized with batch queries."""
    # Get bookmarks from Supabase (using admin client to bypass RLS)
    client = supabase_admin or supabase
    response = client.table("bookmarks").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()

    if not response.data:
        return []

    bookmarks = response.data

    # Collect all unique surah_ids and ayah_ids for batch queries
    surah_ids = list(set(bm["surah_id"] for bm in bookmarks))
    ayah_ids = list(set(bm["ayah_id"] for bm in bookmarks))

    # Enrich with Quran data from SQLite using BATCH queries (much faster!)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Get English translation edition ID once
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", ("en.sahih",))
        en_edition_row = cursor.fetchone()
        en_edition_id = en_edition_row[0] if en_edition_row else None

        # BATCH QUERY 1: Get all surah info in a single query
        surahs_data = {}
        if surah_ids:
            placeholders = ",".join("?" * len(surah_ids))
            cursor.execute(f"""
                SELECT id, name, english_name, english_name_translation, revelation_type, number_of_ayahs
                FROM surahs
                WHERE id IN ({placeholders})
            """, surah_ids)
            for row in cursor.fetchall():
                surahs_data[row["id"]] = dict(row)

        # BATCH QUERY 2: Get all ayah texts in a single query
        ayahs_data = {}
        if ayah_ids:
            placeholders = ",".join("?" * len(ayah_ids))
            cursor.execute(f"""
                SELECT id, text
                FROM ayahs
                WHERE id IN ({placeholders})
            """, ayah_ids)
            for row in cursor.fetchall():
                ayahs_data[row["id"]] = row["text"]

        # BATCH QUERY 3: Get all English translations in a single query
        english_translations = {}
        if en_edition_id and bookmarks:
            # Build WHERE clause for (surah_id, number_in_surah) pairs
            pairs = [(bm["surah_id"], bm["ayah_number_in_surah"]) for bm in bookmarks]
            # Use a more efficient query with OR conditions
            or_conditions = " OR ".join(["(surah_id = ? AND number_in_surah = ?)"] * len(pairs))
            flat_params = [val for pair in pairs for val in pair]
            cursor.execute(f"""
                SELECT surah_id, number_in_surah, text
                FROM ayahs
                WHERE edition_id = ? AND ({or_conditions})
            """, [en_edition_id] + flat_params)

            for row in cursor.fetchall():
                # Create a key for lookup
                key = (row["surah_id"], row["number_in_surah"])
                english_translations[key] = row["text"]

        # Build enriched bookmarks using the batch-fetched data
        enriched_bookmarks = []
        for bm in bookmarks:
            surah = surahs_data.get(bm["surah_id"], {})
            ayah_text = ayahs_data.get(bm["ayah_id"], "")
            ayah_english = english_translations.get((bm["surah_id"], bm["ayah_number_in_surah"]), "")

            enriched_bookmarks.append({
                "id": bm["id"],
                "ayah_id": bm["ayah_id"],
                "surah_id": bm["surah_id"],
                "ayah_number_in_surah": bm["ayah_number_in_surah"],
                "created_at": bm["created_at"],
                "surah_name": surah.get("name", ""),
                "english_name": surah.get("english_name", ""),
                "english_name_translation": surah.get("english_name_translation", ""),
                "revelation_type": surah.get("revelation_type", ""),
                "number_of_ayahs": surah.get("number_of_ayahs", 0),
                "ayah_text": ayah_text,
                "ayah_english": ayah_english
            })

        return enriched_bookmarks
    finally:
        conn.close()


@app.post("/api/bookmarks")
async def create_bookmark(
    data: BookmarkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new bookmark in Supabase."""
    client = supabase_admin or supabase
    try:
        response = client.table("bookmarks").insert({
            "user_id": current_user["id"],
            "ayah_id": data.ayah_id,
            "surah_id": data.surah_id,
            "ayah_number_in_surah": data.ayah_number_in_surah
        }).execute()

        return {"success": True, "id": response.data[0]["id"] if response.data else None}
    except Exception as e:
        # Likely duplicate bookmark
        return {"success": True, "id": None}


@app.delete("/api/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a bookmark from Supabase."""
    client = supabase_admin or supabase
    client.table("bookmarks").delete().eq("id", bookmark_id).eq("user_id", current_user["id"]).execute()
    return {"success": True}


@app.get("/api/bookmarks/exists/{ayah_id}")
async def check_bookmark(ayah_id: int, current_user: dict = Depends(get_current_user)):
    """Check if an ayah is bookmarked."""
    client = supabase_admin or supabase
    response = client.table("bookmarks").select("id").eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()

    bookmarked = len(response.data) > 0
    bookmark_id = response.data[0]["id"] if bookmarked else None

    return {"bookmarked": bookmarked, "bookmark_id": bookmark_id}


@app.get("/api/bookmarks/surah/{surah_id}")
async def get_bookmarks_for_surah(surah_id: int, current_user: dict = Depends(get_current_user)):
    """Get all bookmarks for a specific surah (batch endpoint). Returns map of ayah_id -> bookmark_id."""
    client = supabase_admin or supabase
    response = client.table("bookmarks").select("ayah_id", "id").eq("user_id", current_user["id"]).eq("surah_id", surah_id).execute()

    return {bm["ayah_id"]: bm["id"] for bm in response.data}


# =============================================================================
# PROGRESS TRACKING ENDPOINTS (Supabase + SQLite)
# =============================================================================

class ProgressUpdateRequest(BaseModel):
    surah_id: int
    ayah_id: int
    ayah_number: int


@app.post("/api/progress")
async def update_progress(
    data: ProgressUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update reading progress for a surah in Supabase."""
    client = supabase_admin or supabase
    today = datetime.now().strftime("%Y-%m-%d")

    # Check if progress exists
    existing = client.table("reading_progress").select("*").eq("user_id", current_user["id"]).eq("surah_id", data.surah_id).execute()

    if existing.data:
        # Update existing progress
        client.table("reading_progress").update({
            "last_read_ayah_id": data.ayah_id,
            "last_read_ayah_number": data.ayah_number,
            "last_read_date": today,
            "updated_at": datetime.now().isoformat()
        }).eq("user_id", current_user["id"]).eq("surah_id", data.surah_id).execute()

        # Track daily reading if different ayah
        if existing.data[0]["last_read_ayah_id"] != data.ayah_id:
            daily = client.table("daily_readings").select("*").eq("user_id", current_user["id"]).eq("read_date", today).execute()
            if daily.data:
                client.table("daily_readings").update({"ayahs_read": daily.data[0]["ayahs_read"] + 1}).eq("user_id", current_user["id"]).eq("read_date", today).execute()
            else:
                client.table("daily_readings").insert({"user_id": current_user["id"], "read_date": today, "ayahs_read": 1}).execute()
    else:
        # Create new progress record
        client.table("reading_progress").insert({
            "user_id": current_user["id"],
            "surah_id": data.surah_id,
            "last_read_ayah_id": data.ayah_id,
            "last_read_ayah_number": data.ayah_number,
            "total_ayahs_read": 1,
            "last_read_date": today
        }).execute()

        # Track daily reading
        daily = client.table("daily_readings").select("*").eq("user_id", current_user["id"]).eq("read_date", today).execute()
        if daily.data:
            client.table("daily_readings").update({"ayahs_read": daily.data[0]["ayahs_read"] + 1}).eq("user_id", current_user["id"]).eq("read_date", today).execute()
        else:
            client.table("daily_readings").insert({"user_id": current_user["id"], "read_date": today, "ayahs_read": 1}).execute()

    return {"success": True}


@app.get("/api/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    """Get all reading progress for the current user."""
    # Use admin client to bypass RLS since we've already verified the user
    client = supabase_admin or supabase

    # Get progress from Supabase
    response = client.table("reading_progress").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).execute()

    if not response.data:
        return []

    progress = response.data

    # Enrich with surah data from SQLite
    conn = get_db_connection()
    try:
        enriched = []
        for p in progress:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT name, english_name, number_of_ayahs
                FROM surahs
                WHERE id = ?
            """, (p["surah_id"],))
            surah = cursor.fetchone()

            enriched.append({
                "surah_id": p["surah_id"],
                "last_read_ayah_id": p["last_read_ayah_id"],
                "last_read_ayah_number": p["last_read_ayah_number"],
                "total_ayahs_read": p["total_ayahs_read"],
                "last_read_date": p["last_read_date"],
                "updated_at": p["updated_at"],
                "surah_name": surah["name"] if surah else "",
                "english_name": surah["english_name"] if surah else "",
                "number_of_ayahs": surah["number_of_ayahs"] if surah else 0
            })

        return enriched
    finally:
        conn.close()


@app.get("/api/progress/stats")
async def get_progress_stats(current_user: dict = Depends(get_current_user)):
    """Get reading statistics for the current user from Supabase."""
    client = supabase_admin or supabase

    # Total ayahs read
    daily_response = client.table("daily_readings").select("ayahs_read").eq("user_id", current_user["id"]).execute()
    total_ayahs = sum(d["ayahs_read"] for d in daily_response.data) if daily_response.data else 0

    # Total surahs with progress
    progress_response = client.table("reading_progress").select("surah_id").eq("user_id", current_user["id"]).execute()
    total_surahs = len(set(p["surah_id"] for p in progress_response.data)) if progress_response.data else 0

    # Total bookmarks
    bookmarks_response = client.table("bookmarks").select("id").eq("user_id", current_user["id"]).execute()
    total_bookmarks = len(bookmarks_response.data) if bookmarks_response.data else 0

    # Calculate reading streak
    daily_dates_response = client.table("daily_readings").select("read_date").eq("user_id", current_user["id"]).order("read_date", desc=True).limit(365).execute()
    streak = 0

    if daily_dates_response.data:
        dates = sorted(list(set(d["read_date"] for d in daily_dates_response.data)), reverse=True)
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        if dates and (dates[0] == today or dates[0] == yesterday):
            streak = 1
            expected_date = (datetime.now() - timedelta(days=1 if dates[0] == today else 2)).strftime("%Y-%m-%d")

            for date in dates[1:]:
                if date == expected_date:
                    streak += 1
                    expected_date = (datetime.strptime(expected_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
                else:
                    break

    return {
        "total_ayahs_read": total_ayahs,
        "total_surahs_read": total_surahs,
        "total_bookmarks": total_bookmarks,
        "reading_streak": streak
    }


@app.get("/api/progress/last-position")
async def get_last_position(current_user: dict = Depends(get_current_user)):
    """Get the last reading position for resuming."""
    client = supabase_admin or supabase
    response = client.table("reading_progress").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).limit(1).execute()

    if not response.data:
        return None

    p = response.data[0]

    # Enrich with surah data from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name, english_name, number_of_ayahs
            FROM surahs
            WHERE id = ?
        """, (p["surah_id"],))
        surah = cursor.fetchone()

        return {
            "surah_id": p["surah_id"],
            "last_read_ayah_id": p["last_read_ayah_id"],
            "last_read_ayah_number": p["last_read_ayah_number"],
            "last_read_date": p["last_read_date"],
            "surah_name": surah["name"] if surah else "",
            "english_name": surah["english_name"] if surah else "",
            "number_of_ayahs": surah["number_of_ayahs"] if surah else 0
        }
    finally:
        conn.close()


# =============================================================================
# COMPLETION TRACKING ENDPOINTS (Supabase + SQLite)
# =============================================================================

class CompleteAyahRequest(BaseModel):
    ayah_id: int
    surah_id: int
    ayah_number: int


@app.post("/api/completed-ayahs")
async def mark_ayah_completed(
    data: CompleteAyahRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark an ayah as completed in Supabase."""
    try:
        client = supabase_admin or supabase
        client.table("completed_ayahs").insert({
            "user_id": current_user["id"],
            "ayah_id": data.ayah_id,
            "surah_id": data.surah_id,
            "ayah_number": data.ayah_number
        }).execute()
    except Exception:
        # Already completed - ignore
        pass
    return {"success": True}


class BatchCompletionItem(BaseModel):
    ayah_id: int
    surah_id: int
    ayah_number: int


class BatchCompletionRequest(BaseModel):
    ayahs: List[BatchCompletionItem]


@app.post("/api/completed-ayahs/batch")
async def mark_ayahs_batch_completed(
    data: BatchCompletionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark multiple ayahs as completed in a single batch."""
    if not data.ayahs:
        return {"success": True, "count": 0}

    client = supabase_admin or supabase
    
    # Prepare data for bulk insert
    insert_data = []
    for item in data.ayahs:
        insert_data.append({
            "user_id": current_user["id"],
            "ayah_id": item.ayah_id,
            "surah_id": item.surah_id,
            "ayah_number": item.ayah_number
        })
    
    try:
        # Perform bulk insert/upsert
        # ignore_duplicates=True ensures we don't fail if some are already marked
        client.table("completed_ayahs").upsert(
            insert_data, 
            on_conflict="user_id, ayah_id",
            ignore_duplicates=True
        ).execute()
        
        return {"success": True, "count": len(insert_data)}
    except Exception as e:
        print(f"Batch completion error: {e}")
        # Just return success false rather than 500 to prevent frontend crash loops
        return {"success": False, "error": str(e)}


@app.get("/api/completed-ayahs/surah/{surah_id}")
async def get_completed_ayahs_for_surah(
    surah_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get list of completed ayah IDs for a specific surah from Supabase."""
    client = supabase_admin or supabase
    response = client.table("completed_ayahs").select("ayah_id", "ayah_number", "completed_at").eq("user_id", current_user["id"]).eq("surah_id", surah_id).order("ayah_number").execute()
    return response.data if response.data else []


@app.get("/api/completed-ayahs/stats/{surah_id}")
async def get_surah_completion_stats(
    surah_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get completion stats for a specific surah."""
    # Get total ayahs in surah from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT number_of_ayahs FROM surahs WHERE id = ?", (surah_id,))
        surah = cursor.fetchone()
        if not surah:
            raise HTTPException(status_code=404, detail="Surah not found")

        total_ayahs = surah["number_of_ayahs"]
    finally:
        conn.close()

    # Get completed count from Supabase
    client = supabase_admin or supabase
    completed_response = client.table("completed_ayahs").select("ayah_id", "ayah_number").eq("user_id", current_user["id"]).eq("surah_id", surah_id).execute()
    completed_count = len(completed_response.data) if completed_response.data else 0
    completed_numbers = [c["ayah_number"] for c in completed_response.data] if completed_response.data else []

    # Get first unread ayah from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if completed_numbers:
            placeholders = ",".join("?" * len(completed_numbers))
            cursor.execute(f"""
                SELECT MIN(number_in_surah) as first_unread
                FROM ayahs
                WHERE surah_id = ? AND number_in_surah NOT IN ({placeholders})
            """, [surah_id] + completed_numbers)
            first_unread = cursor.fetchone()["first_unread"]
        else:
            cursor.execute("SELECT MIN(number_in_surah) as first_unread FROM ayahs WHERE surah_id = ?", (surah_id,))
            first_unread = cursor.fetchone()["first_unread"]
    finally:
        conn.close()

    return {
        "total_ayahs": total_ayahs,
        "completed_count": completed_count,
        "completion_percentage": round((completed_count / total_ayahs) * 100, 1) if total_ayahs > 0 else 0,
        "first_unread_ayah": first_unread,
        "completed_ayah_numbers": completed_numbers
    }


@app.get("/api/completed-ayahs/first-unread")
async def get_first_unread_ayah(current_user: dict = Depends(get_current_user)):
    """Get the first unread ayah across all surahs (for global resume)."""
    # Get all completed ayahs from Supabase
    client = supabase_admin or supabase
    completed_response = client.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
    completed_ayah_ids = [c["ayah_id"] for c in completed_response.data] if completed_response.data else []

    # Get first unread ayah from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if completed_ayah_ids:
            placeholders = ",".join("?" * len(completed_ayah_ids))
            cursor.execute(f"""
                SELECT a.surah_id, a.number_in_surah as first_unread_ayah,
                       s.name as surah_name, s.english_name, s.number_of_ayahs
                FROM ayahs a
                JOIN surahs s ON s.id = a.surah_id
                WHERE a.id NOT IN ({placeholders})
                ORDER BY a.surah_id, a.number_in_surah
                LIMIT 1
            """, completed_ayah_ids)
        else:
            cursor.execute("""
                SELECT a.surah_id, a.number_in_surah as first_unread_ayah,
                       s.name as surah_name, s.english_name, s.number_of_ayahs
                FROM ayahs a
                JOIN surahs s ON s.id = a.surah_id
                ORDER BY a.surah_id, a.number_in_surah
                LIMIT 1
            """)
        result = cursor.fetchone()

        if not result:
            return None

        return dict(result)
    finally:
        conn.close()


@app.get("/api/completed-ayahs/overall-stats")
async def get_overall_completion_stats(current_user: dict = Depends(get_current_user)):
    """Get overall completion statistics across all surahs from Supabase."""
    total_quran_ayahs = 6236

    # Get completed ayahs count
    client = supabase_admin or supabase
    completed_response = client.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
    completed_count = len(completed_response.data) if completed_response.data else 0

    # Get completed surahs count
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, number_of_ayahs FROM surahs")
        all_surahs = cursor.fetchall()

        completed_surahs = 0
        if completed_response.data:
            # Group completed ayahs by surah
            surah_completion = {}
            for c in completed_response.data:
                surah_id = c["surah_id"]
                if surah_id not in surah_completion:
                    surah_completion[surah_id] = 0
                surah_completion[surah_id] += 1

            # Count fully completed surahs
            for surah in all_surahs:
                if surah_completion.get(surah["id"], 0) >= surah["number_of_ayahs"]:
                    completed_surahs += 1
    finally:
        conn.close()

    return {
        "total_ayahs_in_quran": total_quran_ayahs,
        "ayahs_completed": completed_count,
        "completion_percentage": round((completed_count / total_quran_ayahs) * 100, 1),
        "surahs_fully_completed": completed_surahs
    }


@app.get("/api/progress/all-surahs")
async def get_all_surahs_progress(current_user: dict = Depends(get_current_user)):
    """
    Get detailed progress for all 114 surahs.
    Optimized to use Counter for faster counting.
    """
    # Get all surahs basic info
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, number_of_ayahs FROM surahs ORDER BY id")
        all_surahs = cursor.fetchall()
    finally:
        conn.close()

    # Get completed ayahs count per surah - optimized with Counter
    from collections import Counter
    client = supabase_admin or supabase
    completed_response = client.table("completed_ayahs").select("surah_id").eq("user_id", current_user["id"]).execute()

    # Use Counter for O(n) counting instead of manual dictionary operations
    surah_counts = Counter()
    if completed_response.data:
        surah_counts = Counter(item["surah_id"] for item in completed_response.data)

    # Build result - list comprehension is faster than append loop
    return [
        {
            "surah_id": surah["id"],
            "completed_count": surah_counts.get(surah["id"], 0),
            "total_ayahs": surah["number_of_ayahs"],
            "completion_percentage": round((surah_counts.get(surah["id"], 0) / surah["number_of_ayahs"]) * 100, 1) if surah["number_of_ayahs"] > 0 else 0
        }
        for surah in all_surahs
    ]


@app.delete("/api/completed-ayahs/surah/{surah_id}")
async def clear_surah_progress(
    surah_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Clear all completed ayahs for a specific surah."""
    client = supabase_admin or supabase
    response = client.table("completed_ayahs").delete().eq("user_id", current_user["id"]).eq("surah_id", surah_id).execute()
    return {"success": True, "deleted_count": len(response.data) if response.data else 0}


# =============================================================================
# SEQUENTIAL PROGRESS ENDPOINTS (Supabase + SQLite)
# =============================================================================

@app.get("/api/progress/sequential")
async def get_sequential_progress(current_user: dict = Depends(get_current_user)):
    """
    Get true sequential progress - only count ayahs where ALL previous ayahs are complete.
    Returns first incomplete ayah and accurate completion percentage.

    Optimized to avoid iterating all 6236 ayahs when possible.
    Uses surah_id + ayah_number for tracking to avoid edition-specific ayah_id issues.
    """
    client = supabase_admin or supabase

    # Get all completed ayahs with their surah_id and ayah_number, sorted by position
    completed = client.table("completed_ayahs")\
        .select("surah_id, ayah_number")\
        .eq("user_id", current_user["id"])\
        .order("surah_id")\
        .order("ayah_number")\
        .execute()

    if not completed.data or len(completed.data) == 0:
        # No completed ayahs - start at beginning
        return {
            "sequential_count": 0,
            "sequential_percentage": 0,
            "first_incomplete_surah": 1,
            "first_incomplete_ayah": 1,
            "total_ayahs": 6236
        }

    # Create a sorted list of completed positions for efficient gap detection
    completed_positions = [(c["surah_id"], c["ayah_number"]) for c in completed.data]

    # Quick check: if we have very few completions (< 100), iterate through Quran from start
    # If we have many completions (> 1000), iterate backwards from end to find first gap
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        if len(completed_positions) < 5000:
            # Forward iteration: Find first gap by checking Quran from the beginning
            # This is faster when user hasn't completed much
            cursor.execute("""
                SELECT surah_id, number_in_surah
                FROM ayahs
                WHERE surah_id = 1 AND number_in_surah = 1
                ORDER BY surah_id, number_in_surah
                LIMIT 1
            """)
            start_pos = cursor.fetchone()

            if not start_pos:
                return {
                    "sequential_count": 0,
                    "sequential_percentage": 0,
                    "first_incomplete_surah": 1,
                    "first_incomplete_ayah": 1,
                    "total_ayahs": 6236
                }

            # Use a more targeted approach: check only positions near completed ayahs
            # Find the earliest completed ayah, then check backwards from there
            completed_set = set(completed_positions)

            # Start from the earliest completed ayah and work backwards
            min_completed = min(completed_positions)
            surah_id, ayah_num = min_completed

            # Check if we have ALL ayahs from 1:1 to this point
            sequential_count = 0
            first_incomplete_surah = 1
            first_incomplete_ayah = 1

            # Build the canonical Quran position as a tuple for comparison
            # Check sequentially from the beginning
            cursor.execute("""
                SELECT surah_id, number_in_surah
                FROM ayahs
                ORDER BY surah_id, number_in_surah
            """)
            all_positions = cursor.fetchall()

            for pos in all_positions:
                s_id = pos["surah_id"]
                a_num = pos["number_in_surah"]

                if (s_id, a_num) in completed_set:
                    sequential_count += 1
                else:
                    first_incomplete_surah = s_id
                    first_incomplete_ayah = a_num
                    break
            else:
                # All ayahs complete!
                first_incomplete_surah = 114
                first_incomplete_ayah = 6
        else:
            # Backward iteration: When most ayahs are complete, find first gap faster
            # This is optimized for users near completion
            completed_set = set(completed_positions)

            cursor.execute("""
                SELECT surah_id, number_in_surah
                FROM ayahs
                ORDER BY surah_id DESC, number_in_surah DESC
            """)
            all_positions = cursor.fetchall()

            # Find the first gap (going backwards, so last gap going forwards)
            sequential_count = 0
            first_incomplete_surah = 1
            first_incomplete_ayah = 1
            found_gap = False

            for pos in all_positions:
                s_id = pos["surah_id"]
                a_num = pos["number_in_surah"]

                if (s_id, a_num) not in completed_set:
                    first_incomplete_surah = s_id
                    first_incomplete_ayah = a_num
                    found_gap = True
                    break

            # Count how many ayahs are before this gap
            if found_gap:
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM ayahs
                    WHERE (surah_id < ?) OR (surah_id = ? AND number_in_surah < ?)
                """, (first_incomplete_surah, first_incomplete_surah, first_incomplete_ayah))
                result = cursor.fetchone()
                sequential_count = result["count"] if result else 0
            else:
                # All complete
                sequential_count = 6236
                first_incomplete_surah = 114
                first_incomplete_ayah = 6

        sequential_percentage = round((sequential_count / 6236) * 100, 1)

        return {
            "sequential_count": sequential_count,
            "sequential_percentage": sequential_percentage,
            "first_incomplete_surah": first_incomplete_surah,
            "first_incomplete_ayah": first_incomplete_ayah,
            "total_ayahs": 6236
        }
    finally:
        conn.close()


@app.post("/api/progress/validate-sequential")
async def validate_sequential_progress(current_user: dict = Depends(get_current_user)):
    """
    Recalculate sequential progress flags in Supabase.
    Uses surah_id + ayah_number for tracking to avoid edition-specific ayah_id issues.
    """
    client = supabase_admin or supabase
    
    # Get all completed ayahs with their surah_id and ayah_number
    completed = client.table("completed_ayahs").select("surah_id, ayah_number").eq("user_id", current_user["id"]).execute()
    
    if not completed.data:
        return {"success": True, "sequential_count": 0}
    
    # Create a set of (surah_id, ayah_number) tuples for O(1) lookup
    completed_set = set()
    for c in completed.data:
        completed_set.add((c["surah_id"], c["ayah_number"]))
    
    # Get the canonical list of all ayahs in Quran order
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT surah_id, number_in_surah
            FROM ayahs
            ORDER BY surah_id, number_in_surah
        """)
        all_positions = cursor.fetchall()
        
        # Find which completed positions are sequential
        sequential_positions = []
        
        for pos in all_positions:
            surah_id = pos["surah_id"]
            ayah_num = pos["number_in_surah"]
            position_key = (surah_id, ayah_num)
            
            if position_key in completed_set:
                sequential_positions.append(position_key)
            else:
                # Found first incomplete - stop here
                break
        
        # Reset all sequential flags for this user
        client.table("completed_ayahs").update({"is_sequential": False}).eq("user_id", current_user["id"]).execute()
        
        # Mark sequential ones as true using composite key (user_id, surah_id, ayah_number)
        for surah_id, ayah_number in sequential_positions:
            client.table("completed_ayahs").update({"is_sequential": True}).eq("user_id", current_user["id"]).eq("surah_id", surah_id).eq("ayah_number", ayah_number).execute()
        
        return {"success": True, "sequential_count": len(sequential_positions)}
    finally:
        conn.close()


# =============================================================================
# AUDIO ANALYTICS ENDPOINTS (Supabase + SQLite)
# =============================================================================

class PlaySessionStart(BaseModel):
    ayah_id: int
    surah_id: int
    ayah_number: int
    audio_edition: str = "ar.alafasy"

class PlaySessionEnd(BaseModel):
    session_id: str  # UUID in Supabase
    duration_seconds: int


@app.post("/api/analytics/play-start")
async def start_play_session(data: PlaySessionStart, current_user: dict = Depends(get_current_user)):
    """Track when user starts playing an ayah in Supabase."""
    client = supabase_admin or supabase
    response = client.table("play_sessions").insert({
        "user_id": current_user["id"],
        "ayah_id": data.ayah_id,
        "surah_id": data.surah_id,
        "ayah_number": data.ayah_number,
        "audio_edition": data.audio_edition
    }).execute()

    return {"success": True, "session_id": response.data[0]["id"] if response.data else None}


@app.post("/api/analytics/play-end")
async def end_play_session(data: PlaySessionEnd, current_user: dict = Depends(get_current_user)):
    """Track when user finishes playing an ayah (updates duration)."""
    # Get session to find ayah_id
    client = supabase_admin or supabase
    session = client.table("play_sessions").select("ayah_id").eq("id", data.session_id).eq("user_id", current_user["id"]).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    ayah_id = session.data[0]["ayah_id"]

    # Update play session
    client.table("play_sessions").update({
        "completed_at": datetime.now().isoformat(),
        "duration_seconds": data.duration_seconds
    }).eq("id", data.session_id).execute()

    # Update replay stats in Supabase
    existing = client.table("replay_stats").select("*").eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()

    if existing.data:
        client.table("replay_stats").update({
            "play_count": existing.data[0]["play_count"] + 1,
            "total_duration_seconds": existing.data[0]["total_duration_seconds"] + data.duration_seconds,
            "last_played_at": datetime.now().isoformat()
        }).eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()
    else:
        client.table("replay_stats").insert({
            "user_id": current_user["id"],
            "ayah_id": ayah_id,
            "play_count": 1,
            "total_duration_seconds": data.duration_seconds,
            "last_played_at": datetime.now().isoformat()
        }).execute()

    return {"success": True}


@app.get("/api/analytics/replay-stats")
async def get_replay_stats_endpoint(current_user: dict = Depends(get_current_user), limit: int = 10):
    """Get most replayed ayahs (highest play count) from Supabase."""
    client = supabase_admin or supabase
    response = client.table("replay_stats").select("*").eq("user_id", current_user["id"]).order("play_count", desc=True).limit(limit).execute()

    if not response.data:
        return []

    # Enrich with Quran data from SQLite
    conn = get_db_connection()
    try:
        enriched = []
        for rs in response.data:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.number_in_surah, a.surah_id,
                       s.name as surah_name, s.english_name
                FROM ayahs a
                JOIN surahs s ON s.id = a.surah_id
                WHERE a.id = ?
            """, (rs["ayah_id"],))
            result = cursor.fetchone()

            if result:
                enriched.append({
                    "ayah_id": rs["ayah_id"],
                    "play_count": rs["play_count"],
                    "total_duration_seconds": rs["total_duration_seconds"],
                    "number_in_surah": result["number_in_surah"],
                    "surah_id": result["surah_id"],
                    "surah_name": result["surah_name"],
                    "english_name": result["english_name"]
                })

        return enriched
    finally:
        conn.close()


# =============================================================================
# FULL QURAN PLAY MODE ENDPOINTS (Supabase + SQLite)
# =============================================================================

@app.post("/api/quran-play/start")
async def start_quran_play(current_user: dict = Depends(get_current_user)):
    """Start a full Quran play session from first incomplete ayah."""
    # Get all completed ayah IDs from Supabase
    client = supabase_admin or supabase
    completed = client.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
    completed_ayah_ids = [c["ayah_id"] for c in completed.data] if completed.data else []

    # Get first incomplete ayah from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if completed_ayah_ids:
            placeholders = ",".join("?" * len(completed_ayah_ids))
            cursor.execute(f"""
                SELECT MIN(a.surah_id) as surah_id, MIN(a.number_in_surah) as ayah_num
                FROM ayahs a
                WHERE a.id NOT IN ({placeholders})
            """, completed_ayah_ids)
        else:
            cursor.execute("""
                SELECT MIN(surah_id) as surah_id, MIN(number_in_surah) as ayah_num
                FROM ayahs
            """)
        result = cursor.fetchone()

        start_surah = result["surah_id"] if result and result["surah_id"] else 1
        start_ayah = result["ayah_num"] if result and result["ayah_num"] else 1

        # Create session in Supabase
        response = client.table("quran_play_sessions").insert({
            "user_id": current_user["id"],
            "start_surah_id": start_surah,
            "start_ayah_number": start_ayah
        }).execute()

        return {
            "success": True,
            "session_id": response.data[0]["id"] if response.data else None,
            "start_surah": start_surah,
            "start_ayah": start_ayah
        }
    finally:
        conn.close()


@app.get("/api/quran-play/next-ayah/{surah_id}/{ayah_number}")
def get_next_quran_ayah(surah_id: int, ayah_number: int):
    """Get next ayah in Quran order (crosses surah boundaries). Uses SQLite for Quran data."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Try next ayah in current surah
        cursor.execute("""
            SELECT number, surah_id, id, number_in_surah
            FROM ayahs
            WHERE surah_id = ? AND number_in_surah > ?
            ORDER BY number_in_surah
            LIMIT 1
        """, (surah_id, ayah_number))
        next_in_surah = cursor.fetchone()

        if next_in_surah:
            return {
                "ayah_number": next_in_surah["number"],
                "surah_id": next_in_surah["surah_id"],
                "ayah_id": next_in_surah["id"],
                "number_in_surah": next_in_surah["number_in_surah"],
                "is_last": False
            }

        # Try first ayah of next surah
        cursor.execute("""
            SELECT MIN(id) as next_surah_id FROM surahs WHERE id > ?
        """, (surah_id,))
        next_surah = cursor.fetchone()

        if next_surah and next_surah["next_surah_id"]:
            cursor.execute("""
                SELECT number, surah_id, id, number_in_surah
                FROM ayahs
                WHERE surah_id = ?
                ORDER BY number_in_surah
                LIMIT 1
            """, (next_surah["next_surah_id"],))
            first_ayah = cursor.fetchone()

            if first_ayah:
                return {
                    "ayah_number": first_ayah["number"],
                    "surah_id": first_ayah["surah_id"],
                    "ayah_id": first_ayah["id"],
                    "number_in_surah": first_ayah["number_in_surah"],
                    "is_last": False
                }

        return {"is_last": True}
    finally:
        conn.close()


@app.post("/api/quran-play/end/{session_id}")
async def end_quran_play_endpoint(session_id: str, current_user: dict = Depends(get_current_user)):
    """End a Quran play session in Supabase."""
    client = supabase_admin or supabase
    client.table("quran_play_sessions").update({
        "ended_at": datetime.now().isoformat()
    }).eq("id", session_id).eq("user_id", current_user["id"]).execute()

    return {"success": True}


# =============================================================================
# SHARE IMAGE ENDPOINTS
# =============================================================================

@app.get("/api/share/og")
def get_og_image(
    format: str = Query("png", description="Image format (png or jpeg)")
):
    """
    Generate an Open Graph image for the homepage.

    Returns a beautiful promotional image for sharing the Quran Reader app on social media.
    Standard OG dimensions: 1200x630
    """
    from share_image import generate_og_image_bytes

    image_format = format.upper() if format.lower() in ["png", "jpeg", "jpg"] else "PNG"
    image_bytes = generate_og_image_bytes(format=image_format)

    media_type = "image/jpeg" if image_format == "JPEG" else "image/png"
    filename = f"quran-reader-og.{format.lower()}"

    return Response(
        content=image_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
        }
    )


@app.get("/api/share/ayah/{surah_id}/{ayah_number}")
def get_ayah_share_image(
    surah_id: int,
    ayah_number: int,
    edition: str = Query("quran-uthmani", description="Arabic text edition"),
    translation: str = Query("en.sahih", description="Translation edition"),
    square: bool = Query(False, description="Generate square image for Instagram"),
    portrait: bool = Query(False, description="Generate 9:16 portrait for mobile stories"),
    style: str = Query("classic", description="Image style (classic or nature)"),
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
            surah_translation=surah["english_name_translation"],
            total_ayahs=surah["number_of_ayahs"],
            edition_name=edition,
            square=square,
            portrait=portrait,
            style=style,
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
    style: str = Query("classic", description="Image style (classic or nature)"),
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
                   s.name, s.english_name, s.english_name_translation, s.number_of_ayahs
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
            surah_english_name=result["english_name"],
            surah_translation=result["english_name_translation"],
            total_ayahs=result["number_of_ayahs"],
            edition_name="",
            square=square,
            style=style,
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


# =============================================================================
# ISLAMIC EVENTS ENDPOINTS (SQLite)
# =============================================================================

@app.get("/api/events/on-this-day")
def get_on_this_day(
    month: int = Query(None, description="Gregorian month (1-12), defaults to current month"),
    day: int = Query(None, description="Gregorian day (1-31), defaults to current day")
):
    """
    Get Islamic historical events that occurred on a specific day.
    Shows "on this day X years ago" style results.
    """
    from datetime import date

    # Default to today if not provided
    if month is None or day is None:
        today = date.today()
        month = today.month
        day = today.day

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Query events matching this Gregorian day/month
        cursor.execute("""
            SELECT id, title, hijri_year, hijri_month, hijri_day,
                   gregorian_year, gregorian_month, gregorian_day,
                   category, tags, description
            FROM islamic_events
            WHERE gregorian_month = ? AND gregorian_day = ?
            ORDER BY gregorian_year ASC
        """, (month, day))

        rows = cursor.fetchall()

        # Calculate years ago and format display
        current_year = date.today().year
        events = []
        showing_examples = False

        for row in rows:
            gregorian_date = f"{row['gregorian_year']}-{row['gregorian_month']:02d}-{row['gregorian_day']:02d}"
            years_ago = current_year - row['gregorian_year']

            # Determine display text
            if years_ago == 0:
                display = "Today"
            elif years_ago == 1:
                display = "1 year ago today"
            else:
                display = f"{years_ago} years ago today"

            # Parse tags from JSON
            try:
                tags = json.loads(row['tags']) if row['tags'] else []
            except:
                tags = []

            events.append({
                "id": row['id'],
                "title": row['title'],
                "hijri": {
                    "year": row['hijri_year'],
                    "month": row['hijri_month'],
                    "day": row['hijri_day']
                } if row['hijri_year'] else None,
                "gregorian": {
                    "year": row['gregorian_year'],
                    "month": row['gregorian_month'],
                    "day": row['gregorian_day']
                },
                "category": row['category'],
                "tags": tags,
                "description": row['description'],
                "years_ago": years_ago,
                "display": display
            })

        # If no events for this day, show example events
        if not events:
            showing_examples = True
            # Get some notable Islamic events as examples
            cursor.execute("""
                SELECT id, title, hijri_year, hijri_month, hijri_day,
                       gregorian_year, gregorian_month, gregorian_day,
                       category, tags, description
                FROM islamic_events
                WHERE category IN ('milestone', 'battle', 'birth', 'conquest')
                ORDER BY RANDOM()
                LIMIT 5
            """)
            example_rows = cursor.fetchall()

            for row in example_rows:
                years_ago = current_year - row['gregorian_year']
                if years_ago == 0:
                    display = "This year"
                elif years_ago == 1:
                    display = "1 year ago"
                else:
                    display = f"{years_ago} years ago"

                try:
                    tags = json.loads(row['tags']) if row['tags'] else []
                except:
                    tags = []

                events.append({
                    "id": row['id'],
                    "title": row['title'],
                    "hijri": {
                        "year": row['hijri_year'],
                        "month": row['hijri_month'],
                        "day": row['hijri_day']
                    } if row['hijri_year'] else None,
                    "gregorian": {
                        "year": row['gregorian_year'],
                        "month": row['gregorian_month'],
                        "day": row['gregorian_day']
                    },
                    "category": row['category'],
                    "tags": tags,
                    "description": row['description'],
                    "years_ago": years_ago,
                    "display": display,
                    "is_example": True
                })

        return {
            "date": f"{month:02d}-{day:02d}",
            "events": events,
            "total": len(events),
            "showing_examples": showing_examples
        }
    finally:
        conn.close()


@app.get("/api/events/search")
def search_events(
    q: Optional[str] = Query("", description="Search query"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, description="Max results", ge=1, le=200)
):
    """Search Islamic events by query text and/or category."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Build query with filters
        where_conditions = []
        params = []

        # Only add text search if query is provided and has at least 2 characters
        if q and len(q.strip()) >= 2:
            where_conditions.append("(title LIKE ? OR description LIKE ?)")
            params = [f"%{q}%", f"%{q}%"]

        # Filter by category if provided
        if category:
            where_conditions.append("category = ?")
            params.append(category)

        # If no filters, return all events (up to limit)
        if not where_conditions:
            where_clause = "1=1"
        else:
            where_clause = " AND ".join(where_conditions)

        cursor.execute(f"""
            SELECT id, title, hijri_year, hijri_month, hijri_day,
                   gregorian_year, gregorian_month, gregorian_day,
                   category, tags, description
            FROM islamic_events
            WHERE {where_clause}
            ORDER BY gregorian_year ASC
            LIMIT ?
        """, params + [limit])

        rows = cursor.fetchall()

        from datetime import date
        current_year = date.today().year

        events = []
        for row in rows:
            try:
                tags = json.loads(row['tags']) if row['tags'] else []
            except:
                tags = []

            # Calculate years ago and display
            years_ago = current_year - row['gregorian_year']
            if years_ago == 0:
                display = "This year"
            elif years_ago == 1:
                display = "1 year ago"
            else:
                display = f"{years_ago} years ago"

            events.append({
                "id": row['id'],
                "title": row['title'],
                "hijri": {
                    "year": row['hijri_year'],
                    "month": row['hijri_month'],
                    "day": row['hijri_day']
                } if row['hijri_year'] else None,
                "gregorian": {
                    "year": row['gregorian_year'],
                    "month": row['gregorian_month'],
                    "day": row['gregorian_day']
                },
                "category": row['category'],
                "tags": tags,
                "description": row['description'],
                "years_ago": years_ago,
                "display": display
            })

        return {
            "query": q,
            "category": category,
            "results": events,
            "total": len(events)
        }
    finally:
        conn.close()


@app.get("/api/events/categories")
def get_event_categories():
    """Get all available event categories."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM islamic_events
            GROUP BY category
            ORDER BY count DESC
        """)

        rows = cursor.fetchall()
        return {row['category']: row['count'] for row in rows}
    finally:
        conn.close()


@app.get("/api/events/timeline")
def get_events_timeline(
    start_year: int = Query(None, description="Start year (Gregorian)"),
    end_year: int = Query(None, description="End year (Gregorian)"),
    calendar: str = Query("gregorian", description="Calendar system: 'gregorian' or 'hijri'")
):
    """
    Get events within a time period.
    Returns a chronological timeline of Islamic history.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Determine date column
        if calendar == "hijri":
            year_col = "hijri_year"
            if not start_year:
                start_year = 1
            if not end_year:
                end_year = 1500
        else:
            year_col = "gregorian_year"
            if not start_year:
                start_year = 500
            if not end_year:
                end_year = 2100

        cursor.execute(f"""
            SELECT id, title, hijri_year, hijri_month, hijri_day,
                   gregorian_year, gregorian_month, gregorian_day,
                   category, tags, description
            FROM islamic_events
            WHERE {year_col} >= ? AND {year_col} <= ?
            ORDER BY {year_col} ASC, {year_col}_month ASC, {year_col}_day ASC
        """, (start_year, end_year))

        rows = cursor.fetchall()

        events = []
        for row in rows:
            try:
                tags = json.loads(row['tags']) if row['tags'] else []
            except:
                tags = []

            events.append({
                "id": row['id'],
                "title": row['title'],
                "hijri": {
                    "year": row['hijri_year'],
                    "month": row['hijri_month'],
                    "day": row['hijri_day']
                } if row['hijri_year'] else None,
                "gregorian": {
                    "year": row['gregorian_year'],
                    "month": row['gregorian_month'],
                    "day": row['gregorian_day']
                },
                "category": row['category'],
                "tags": tags,
                "description": row['description']
            })

        return {
            "calendar": calendar,
            "start_year": start_year,
            "end_year": end_year,
            "events": events,
            "total": len(events)
        }
    finally:
        conn.close()


@app.get("/api/events/{event_id}")
def get_event(event_id: str):
    """Get a specific event by ID."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, title, hijri_year, hijri_month, hijri_day,
                   gregorian_year, gregorian_month, gregorian_day,
                   category, tags, description
            FROM islamic_events
            WHERE id = ?
        """, (event_id,))

        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")

        try:
            tags = json.loads(row['tags']) if row['tags'] else []
        except:
            tags = []

        # Calculate years ago and display
        from datetime import date
        current_year = date.today().year
        years_ago = current_year - row['gregorian_year']
        if years_ago == 0:
            display = "This year"
        elif years_ago == 1:
            display = "1 year ago"
        else:
            display = f"{years_ago} years ago"

        return {
            "id": row['id'],
            "title": row['title'],
            "hijri": {
                "year": row['hijri_year'],
                "month": row['hijri_month'],
                "day": row['hijri_day']
            } if row['hijri_year'] else None,
            "gregorian": {
                "year": row['gregorian_year'],
                "month": row['gregorian_month'],
                "day": row['gregorian_day']
            },
            "category": row['category'],
            "tags": tags,
            "description": row['description'],
            "years_ago": years_ago,
            "display": display
        }
    finally:
        conn.close()


# =============================================================================
# USER STATS SHARING ENDPOINTS
# =============================================================================

class ShareSettingsRequest(BaseModel):
    theme: Optional[str] = None
    show_reading_progress: Optional[bool] = None
    show_completion: Optional[bool] = None
    show_streak: Optional[bool] = None
    show_bookmarks: Optional[bool] = None
    show_listening_stats: Optional[bool] = None
    enabled: Optional[bool] = None


@app.post("/api/share/generate")
async def generate_share_profile(current_user: dict = Depends(get_current_user)):
    """
    Generate a new share profile for the authenticated user.
    Creates a unique 8-character share_id if one doesn't exist.
    """
    # Check if user already has a share profile
    client = supabase_admin or supabase
    existing = client.table("share_profiles").select("*").eq("user_id", current_user["id"]).execute()

    if existing.data:
        # Return existing share profile
        share_id = existing.data[0]["share_id"]
        share_url = f"https://quran.hyperflash.uk/share/{share_id}"
        return {
            "share_id": share_id,
            "share_url": share_url,
            "theme": existing.data[0].get("theme", "classic"),
            "created_at": existing.data[0].get("created_at")
        }

    # Create new share profile (share_id will be auto-generated by trigger)
    response = client.table("share_profiles").insert({
        "user_id": current_user["id"],
        "theme": "classic",
        "show_reading_progress": True,
        "show_completion": True,
        "show_streak": True,
        "show_bookmarks": False,
        "show_listening_stats": False
    }).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create share profile")

    share_id = response.data[0]["share_id"]
    share_url = f"https://quran.hyperflash.uk/share/{share_id}"

    return {
        "share_id": share_id,
        "share_url": share_url,
        "theme": response.data[0].get("theme", "classic"),
        "created_at": response.data[0].get("created_at")
    }


@app.get("/api/share/settings")
async def get_share_settings(current_user: dict = Depends(get_current_user)):
    """
    Get the current user's share profile settings.
    Returns null if no share profile exists.
    """
    client = supabase_admin or supabase
    response = client.table("share_profiles").select("*").eq("user_id", current_user["id"]).execute()

    if not response.data:
        return None

    profile = response.data[0]
    return {
        "share_id": profile["share_id"],
        "share_url": f"https://quran.hyperflash.uk/share/{profile['share_id']}",
        "theme": profile.get("theme", "classic"),
        "show_reading_progress": profile.get("show_reading_progress", True),
        "show_completion": profile.get("show_completion", True),
        "show_streak": profile.get("show_streak", True),
        "show_bookmarks": profile.get("show_bookmarks", False),
        "show_listening_stats": profile.get("show_listening_stats", False),
        "enabled": profile.get("enabled", True),
        "created_at": profile.get("created_at"),
        "updated_at": profile.get("updated_at")
    }


@app.put("/api/share/settings")
async def update_share_settings(
    data: ShareSettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update the current user's share profile settings.
    Creates a new profile if one doesn't exist.
    """
    client = supabase_admin or supabase

    # Check if profile exists
    existing = client.table("share_profiles").select("*").eq("user_id", current_user["id"]).execute()

    # Build update dict with only provided fields
    update_data = {}
    if data.theme is not None:
        if data.theme not in ["classic", "nature", "dark", "minimal", "ocean", "royal"]:
            raise HTTPException(status_code=400, detail="Invalid theme. Must be: classic, nature, dark, minimal, ocean, or royal")
        update_data["theme"] = data.theme
    if data.show_reading_progress is not None:
        update_data["show_reading_progress"] = data.show_reading_progress
    if data.show_completion is not None:
        update_data["show_completion"] = data.show_completion
    if data.show_streak is not None:
        update_data["show_streak"] = data.show_streak
    if data.show_bookmarks is not None:
        update_data["show_bookmarks"] = data.show_bookmarks
    if data.show_listening_stats is not None:
        update_data["show_listening_stats"] = data.show_listening_stats
    if data.enabled is not None:
        update_data["enabled"] = data.enabled

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if existing.data:
        # Update existing profile
        response = client.table("share_profiles").update(update_data).eq("user_id", current_user["id"]).execute()
        share_id = existing.data[0]["share_id"]
    else:
        # Create new profile
        update_data["user_id"] = current_user["id"]
        response = client.table("share_profiles").insert(update_data).execute()
        share_id = response.data[0]["share_id"] if response.data else None

    if not response.data and existing.data:
        # Update might return no data on success, fetch the profile
        profile = client.table("share_profiles").select("*").eq("user_id", current_user["id"]).execute()
        share_id = profile.data[0]["share_id"] if profile.data else None

    return {
        "success": True,
        "share_id": share_id,
        "share_url": f"https://quran.hyperflash.uk/share/{share_id}" if share_id else None
    }


@app.get("/api/share/{share_id}")
async def get_public_share_stats(share_id: str):
    """
    Get public stats for a share profile.
    This endpoint does NOT require authentication.
    Returns user stats based on their share settings.
    """
    client = supabase_admin or supabase

    # Use the Supabase function to get stats
    try:
        response = client.table("share_profiles").select(
            "user_id",
            "enabled",
            "theme",
            "show_reading_progress",
            "show_completion",
            "show_streak",
            "show_bookmarks",
            "show_listening_stats"
        ).eq("share_id", share_id).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Share profile not found")

    if not response.data:
        raise HTTPException(status_code=404, detail="Share profile not found")

    profile = response.data

    # Check if profile is disabled
    if not profile.get("enabled", True):
        raise HTTPException(status_code=403, detail="This share profile has been disabled by the owner")

    user_id = profile["user_id"]

    # Get user profile info (name, created_at)
    user_profile = client.table("profiles").select("name", "created_at").eq("id", user_id).single().execute()

    if not user_profile.data:
        raise HTTPException(status_code=404, detail="User not found")

    result = {
        "user": {
            "name": user_profile.data.get("name", ""),
            "member_since": user_profile.data.get("created_at")
        },
        "theme": profile.get("theme", "classic"),
        "stats": {}
    }

    # Get stats based on visibility settings
    if profile.get("show_reading_progress") or profile.get("show_completion"):
        # Total ayahs read
        daily_response = client.table("daily_readings").select("ayahs_read").eq("user_id", user_id).execute()
        total_ayahs = sum(d["ayahs_read"] for d in daily_response.data) if daily_response.data else 0

        # Total surahs with progress
        progress_response = client.table("reading_progress").select("surah_id").eq("user_id", user_id).execute()
        total_surahs = len(set(p["surah_id"] for p in progress_response.data)) if progress_response.data else 0

        result["stats"]["reading"] = {
            "total_ayahs_read": total_ayahs,
            "total_surahs_read": total_surahs
        }

    if profile.get("show_completion"):
        # Completion stats
        completed_response = client.table("completed_ayahs").select("ayah_id", "surah_id").eq("user_id", user_id).execute()
        completed_count = len(completed_response.data) if completed_response.data else 0
        completion_percentage = round((completed_count / 6236) * 100, 1) if completed_count > 0 else 0

        # Count fully completed surahs
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id, number_of_ayahs FROM surahs")
            all_surahs = cursor.fetchall()

            completed_surahs = 0
            if completed_response.data:
                surah_completion = {}
                for c in completed_response.data:
                    surah_id = c["surah_id"]
                    if surah_id not in surah_completion:
                        surah_completion[surah_id] = 0
                    surah_completion[surah_id] += 1

                for surah in all_surahs:
                    if surah_completion.get(surah["id"], 0) >= surah["number_of_ayahs"]:
                        completed_surahs += 1
        finally:
            conn.close()

        result["stats"]["completion"] = {
            "completion_percentage": completion_percentage,
            "ayahs_completed": completed_count,
            "surahs_completed": completed_surahs
        }

    if profile.get("show_streak"):
        # Calculate reading streak
        daily_dates_response = client.table("daily_readings").select("read_date").eq("user_id", user_id).order("read_date", desc=True).limit(365).execute()
        streak = 0

        if daily_dates_response.data:
            dates = sorted(list(set(d["read_date"] for d in daily_dates_response.data)), reverse=True)
            today = datetime.now().strftime("%Y-%m-%d")
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

            if dates and (dates[0] == today or dates[0] == yesterday):
                streak = 1
                expected_date = (datetime.now() - timedelta(days=1 if dates[0] == today else 2)).strftime("%Y-%m-%d")

                for date in dates[1:]:
                    if date == expected_date:
                        streak += 1
                        expected_date = (datetime.strptime(expected_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
                    else:
                        break

        result["stats"]["streak"] = streak

    if profile.get("show_bookmarks"):
        # Get bookmarks count
        bookmarks_response = client.table("bookmarks").select("id").eq("user_id", user_id).execute()
        result["stats"]["bookmarks"] = len(bookmarks_response.data) if bookmarks_response.data else 0

    if profile.get("show_listening_stats"):
        # Get listening stats
        replay_response = client.table("replay_stats").select("play_count", "total_duration_seconds").eq("user_id", user_id).execute()

        total_plays = 0
        total_seconds = 0

        if replay_response.data:
            for r in replay_response.data:
                total_plays += r.get("play_count", 0)
                total_seconds += r.get("total_duration_seconds", 0)

        result["stats"]["listening"] = {
            "total_plays": total_plays,
            "total_minutes": round(total_seconds / 60) if total_seconds > 0 else 0
        }

    return result


@app.get("/api/share/og/{share_id}.png")
async def get_share_og_image(share_id: str):
    """
    Generate an Open Graph image for a share profile.
    Returns a beautiful image for social media previews.
    """
    from share_image import generate_share_profile_image_bytes

    client = supabase_admin or supabase

    # Fetch share profile and stats
    try:
        profile_response = client.table("share_profiles").select(
            "user_id", "theme"
        ).eq("share_id", share_id).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Share profile not found")

    if not profile_response.data:
        raise HTTPException(status_code=404, detail="Share profile not found")

    user_id = profile_response.data["user_id"]
    theme = profile_response.data.get("theme", "classic")

    # Get user profile
    user_profile = client.table("profiles").select("name").eq("id", user_id).single().execute()

    if not user_profile.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_name = user_profile.data.get("name", "Quran Reader")

    # Get key stats for the image
    # Completion %
    completed_response = client.table("completed_ayahs").select("ayah_id").eq("user_id", user_id).execute()
    completed_count = len(completed_response.data) if completed_response.data else 0
    completion_pct = round((completed_count / 6236) * 100, 1) if completed_count > 0 else 0

    # Streak
    daily_dates_response = client.table("daily_readings").select("read_date").eq("user_id", user_id).order("read_date", desc=True).limit(365).execute()
    streak = 0
    if daily_dates_response.data:
        dates = sorted(list(set(d["read_date"] for d in daily_dates_response.data)), reverse=True)
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        if dates and (dates[0] == today or dates[0] == yesterday):
            streak = 1
            expected_date = (datetime.now() - timedelta(days=1 if dates[0] == today else 2)).strftime("%Y-%m-%d")
            for date in dates[1:]:
                if date == expected_date:
                    streak += 1
                    expected_date = (datetime.strptime(expected_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
                else:
                    break

    # Total ayahs
    daily_response = client.table("daily_readings").select("ayahs_read").eq("user_id", user_id).execute()
    total_ayahs = sum(d["ayahs_read"] for d in daily_response.data) if daily_response.data else 0

    # Generate image
    try:
        image_bytes = generate_share_profile_image_bytes(
            user_name=user_name,
            completion_percentage=completion_pct,
            streak=streak,
            total_ayahs=total_ayahs,
            theme=theme,
            format="PNG"
        )
    except Exception as e:
        print(f"Error generating share image: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate image")

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="{share_id}.png"',
            "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
