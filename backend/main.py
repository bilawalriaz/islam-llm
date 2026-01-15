"""
Quran Reader API - Backend Server

FastAPI server that serves Quran data from SQLite database
and provides audio file streaming with user authentication via Supabase,
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

# Supabase integration
from supabase import create_client, Client

# Database paths
DB_PATH = Path(__file__).parent.parent / "quran-dump" / "quran.db"
AUDIO_PATH = Path(__file__).parent.parent / "quran-dump" / "audio"

# Supabase configuration
SUPABASE_URL = "https://zxmyoojcuihavbhiblwc.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4bXlvb2pjdWloYXZiaGlibHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDMwODAsImV4cCI6MjA4NDA3OTA4MH0.WTrrU42RBAW1rIxukNsVDYZ5ifYMiuQe_nlpEPgkjsM")

# Create Supabase client for public operations
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Quran Reader API")

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
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization[7:]  # Remove "Bearer " prefix

    try:
        # Verify the JWT token with Supabase
        user = supabase.auth.get_user(token)
        if user and user.user:
            return user.user.id
        return None
    except Exception:
        return None


async def get_current_user(user_id: str = Depends(verify_token)):
    """Get current user profile from Supabase."""
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or missing token")

    try:
        response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()

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
        if data.provider != "google":
            raise HTTPException(status_code=400, detail="Unsupported provider")

        # Create a new Supabase client and set session with OAuth tokens
        from supabase import create_client
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Set the session using the OAuth tokens
        auth_client.auth.set_session(data.access_token, data.refresh_token)

        # Get the user to verify the session is valid
        user_response = auth_client.auth.get_user()
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid OAuth tokens")

        oauth_user_id = user_response.user.id
        oauth_email = user_response.user.email

        # Check if there's an existing profile with this email (from email/password registration)
        existing_profile = supabase.table("profiles").select("*").eq("email", oauth_email).execute()

        # Get or create profile for the OAuth user
        oauth_profile = supabase.table("profiles").select("*").eq("id", oauth_user_id).execute()

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
                    await _migrate_account_data(existing_user_id, oauth_user_id)

                    # Update OAuth profile with existing data (preserve name, etc.)
                    supabase.table("profiles").update({
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
                    supabase.table("profiles").insert(new_profile).execute()

                    # Migrate data from old account to new OAuth account
                    await _migrate_account_data(existing_user_id, oauth_user_id)

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
            new_profile = {
                "id": oauth_user_id,
                "email": oauth_email,
                "name": user_response.user.user_metadata.get("name", "") or user_response.user.user_metadata.get("full_name", ""),
                "created_at": datetime.now().isoformat()
            }
            supabase.table("profiles").insert(new_profile).execute()
            user_name = new_profile["name"]

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


async def _migrate_account_data(from_user_id: str, to_user_id: str):
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
    # Migrate bookmarks
    existing_bookmarks = supabase.table("bookmarks").select("*").eq("user_id", from_user_id).execute()
    if existing_bookmarks.data:
        for bm in existing_bookmarks.data:
            try:
                supabase.table("bookmarks").insert({
                    "user_id": to_user_id,
                    "ayah_id": bm["ayah_id"],
                    "surah_id": bm["surah_id"],
                    "ayah_number_in_surah": bm["ayah_number_in_surah"],
                    "created_at": bm["created_at"]
                }).execute()
            except Exception:
                pass  # Duplicate bookmarks are ok

    # Migrate reading_progress
    existing_progress = supabase.table("reading_progress").select("*").eq("user_id", from_user_id).execute()
    if existing_progress.data:
        for p in existing_progress.data:
            try:
                supabase.table("reading_progress").insert({
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
    existing_daily = supabase.table("daily_readings").select("*").eq("user_id", from_user_id).execute()
    if existing_daily.data:
        for d in existing_daily.data:
            try:
                supabase.table("daily_readings").insert({
                    "user_id": to_user_id,
                    "read_date": d["read_date"],
                    "ayahs_read": d["ayahs_read"]
                }).execute()
            except Exception:
                pass

    # Migrate completed_ayahs
    existing_completed = supabase.table("completed_ayahs").select("*").eq("user_id", from_user_id).execute()
    if existing_completed.data:
        for c in existing_completed.data:
            try:
                supabase.table("completed_ayahs").insert({
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
    existing_sessions = supabase.table("play_sessions").select("*").eq("user_id", from_user_id).execute()
    if existing_sessions.data:
        for s in existing_sessions.data:
            try:
                supabase.table("play_sessions").insert({
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
    existing_replay = supabase.table("replay_stats").select("*").eq("user_id", from_user_id).execute()
    if existing_replay.data:
        for r in existing_replay.data:
            try:
                supabase.table("replay_stats").insert({
                    "user_id": to_user_id,
                    "ayah_id": r["ayah_id"],
                    "play_count": r["play_count"],
                    "total_duration_seconds": r["total_duration_seconds"],
                    "last_played_at": r["last_played_at"]
                }).execute()
            except Exception:
                pass

    # Migrate quran_play_sessions
    existing_quran_sessions = supabase.table("quran_play_sessions").select("*").eq("user_id", from_user_id).execute()
    if existing_quran_sessions.data:
        for qs in existing_quran_sessions.data:
            try:
                supabase.table("quran_play_sessions").insert({
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
    """Get all bookmarks for the current user."""
    # Get bookmarks from Supabase
    response = supabase.table("bookmarks").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()

    if not response.data:
        return []

    bookmarks = response.data

    # Enrich with Quran data from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", ("quran-uthmani",))
        edition_row = cursor.fetchone()
        edition_id = edition_row[0] if edition_row else 1

        # Get English translation edition
        cursor.execute("SELECT id FROM editions WHERE identifier = ?", ("en.sahih",))
        en_edition_row = cursor.fetchone()
        en_edition_id = en_edition_row[0] if en_edition_row else None

        enriched_bookmarks = []
        for bm in bookmarks:
            # Get surah info
            cursor.execute("""
                SELECT name, english_name, english_name_translation, revelation_type, number_of_ayahs
                FROM surahs
                WHERE id = ?
            """, (bm["surah_id"],))
            surah = cursor.fetchone()

            # Get ayah text (Arabic)
            cursor.execute("""
                SELECT text
                FROM ayahs
                WHERE id = ?
            """, (bm["ayah_id"],))
            ayah = cursor.fetchone()

            # Get English translation
            ayah_english = ""
            if en_edition_id:
                cursor.execute("""
                    SELECT text
                    FROM ayahs
                    WHERE surah_id = ? AND number_in_surah = ? AND edition_id = ?
                """, (bm["surah_id"], bm["ayah_number_in_surah"], en_edition_id))
                en_ayah = cursor.fetchone()
                if en_ayah:
                    ayah_english = en_ayah["text"]

            enriched_bookmarks.append({
                "id": bm["id"],
                "ayah_id": bm["ayah_id"],
                "surah_id": bm["surah_id"],
                "ayah_number_in_surah": bm["ayah_number_in_surah"],
                "created_at": bm["created_at"],
                "surah_name": surah["name"] if surah else "",
                "english_name": surah["english_name"] if surah else "",
                "english_name_translation": surah["english_name_translation"] if surah else "",
                "revelation_type": surah["revelation_type"] if surah else "",
                "number_of_ayahs": surah["number_of_ayahs"] if surah else 0,
                "ayah_text": ayah["text"] if ayah else "",
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
    try:
        response = supabase.table("bookmarks").insert({
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
    supabase.table("bookmarks").delete().eq("id", bookmark_id).eq("user_id", current_user["id"]).execute()
    return {"success": True}


@app.get("/api/bookmarks/exists/{ayah_id}")
async def check_bookmark(ayah_id: int, current_user: dict = Depends(get_current_user)):
    """Check if an ayah is bookmarked."""
    response = supabase.table("bookmarks").select("id").eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()

    bookmarked = len(response.data) > 0
    bookmark_id = response.data[0]["id"] if bookmarked else None

    return {"bookmarked": bookmarked, "bookmark_id": bookmark_id}


@app.get("/api/bookmarks/surah/{surah_id}")
async def get_bookmarks_for_surah(surah_id: int, current_user: dict = Depends(get_current_user)):
    """Get all bookmarks for a specific surah (batch endpoint). Returns map of ayah_id -> bookmark_id."""
    response = supabase.table("bookmarks").select("ayah_id", "id").eq("user_id", current_user["id"]).eq("surah_id", surah_id).execute()

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
    today = datetime.now().strftime("%Y-%m-%d")

    # Check if progress exists
    existing = supabase.table("reading_progress").select("*").eq("user_id", current_user["id"]).eq("surah_id", data.surah_id).execute()

    if existing.data:
        # Update existing progress
        supabase.table("reading_progress").update({
            "last_read_ayah_id": data.ayah_id,
            "last_read_ayah_number": data.ayah_number,
            "last_read_date": today,
            "updated_at": datetime.now().isoformat()
        }).eq("user_id", current_user["id"]).eq("surah_id", data.surah_id).execute()

        # Track daily reading if different ayah
        if existing.data[0]["last_read_ayah_id"] != data.ayah_id:
            daily = supabase.table("daily_readings").select("*").eq("user_id", current_user["id"]).eq("read_date", today).execute()
            if daily.data:
                supabase.table("daily_readings").update({"ayahs_read": daily.data[0]["ayahs_read"] + 1}).eq("user_id", current_user["id"]).eq("read_date", today).execute()
            else:
                supabase.table("daily_readings").insert({"user_id": current_user["id"], "read_date": today, "ayahs_read": 1}).execute()
    else:
        # Create new progress record
        supabase.table("reading_progress").insert({
            "user_id": current_user["id"],
            "surah_id": data.surah_id,
            "last_read_ayah_id": data.ayah_id,
            "last_read_ayah_number": data.ayah_number,
            "total_ayahs_read": 1,
            "last_read_date": today
        }).execute()

        # Track daily reading
        daily = supabase.table("daily_readings").select("*").eq("user_id", current_user["id"]).eq("read_date", today).execute()
        if daily.data:
            supabase.table("daily_readings").update({"ayahs_read": daily.data[0]["ayahs_read"] + 1}).eq("user_id", current_user["id"]).eq("read_date", today).execute()
        else:
            supabase.table("daily_readings").insert({"user_id": current_user["id"], "read_date": today, "ayahs_read": 1}).execute()

    return {"success": True}


@app.get("/api/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    """Get all reading progress for the current user."""
    # Get progress from Supabase
    response = supabase.table("reading_progress").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).execute()

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
    # Total ayahs read
    daily_response = supabase.table("daily_readings").select("ayahs_read").eq("user_id", current_user["id"]).execute()
    total_ayahs = sum(d["ayahs_read"] for d in daily_response.data) if daily_response.data else 0

    # Total surahs with progress
    progress_response = supabase.table("reading_progress").select("surah_id").eq("user_id", current_user["id"]).execute()
    total_surahs = len(set(p["surah_id"] for p in progress_response.data)) if progress_response.data else 0

    # Total bookmarks
    bookmarks_response = supabase.table("bookmarks").select("id").eq("user_id", current_user["id"]).execute()
    total_bookmarks = len(bookmarks_response.data) if bookmarks_response.data else 0

    # Calculate reading streak
    daily_dates_response = supabase.table("daily_readings").select("read_date").eq("user_id", current_user["id"]).order("read_date", desc=True).limit(365).execute()
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
    response = supabase.table("reading_progress").select("*").eq("user_id", current_user["id"]).order("updated_at", desc=True).limit(1).execute()

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
        supabase.table("completed_ayahs").insert({
            "user_id": current_user["id"],
            "ayah_id": data.ayah_id,
            "surah_id": data.surah_id,
            "ayah_number": data.ayah_number
        }).execute()
    except Exception:
        # Already completed - ignore
        pass
    return {"success": True}


@app.get("/api/completed-ayahs/surah/{surah_id}")
async def get_completed_ayahs_for_surah(
    surah_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get list of completed ayah IDs for a specific surah from Supabase."""
    response = supabase.table("completed_ayahs").select("ayah_id", "ayah_number", "completed_at").eq("user_id", current_user["id"]).eq("surah_id", surah_id).order("ayah_number").execute()
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
    completed_response = supabase.table("completed_ayahs").select("ayah_id", "ayah_number").eq("user_id", current_user["id"]).eq("surah_id", surah_id).execute()
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
    completed_response = supabase.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
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
    completed_response = supabase.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
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


# =============================================================================
# SEQUENTIAL PROGRESS ENDPOINTS (Supabase + SQLite)
# =============================================================================

@app.get("/api/progress/sequential")
async def get_sequential_progress(current_user: dict = Depends(get_current_user)):
    """
    Get true sequential progress - only count ayahs where ALL previous ayahs are complete.
    Returns first incomplete ayah and accurate completion percentage.
    """
    # Get completed ayahs with is_sequential flag from Supabase
    response = supabase.table("completed_ayahs").select("*").eq("user_id", current_user["id"]).eq("is_sequential", True).execute()
    sequential_count = len(response.data) if response.data else 0

    # Get all completed ayah IDs
    all_completed = supabase.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
    completed_ayah_ids = [c["ayah_id"] for c in all_completed.data] if all_completed.data else []

    # Find first incomplete ayah from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if completed_ayah_ids:
            placeholders = ",".join("?" * len(completed_ayah_ids))
            cursor.execute(f"""
                SELECT MIN(a.number) as ayah_num, MIN(a.surah_id) as surah_id, MIN(a.number_in_surah) as ayah_in_surah
                FROM ayahs a
                WHERE a.id NOT IN ({placeholders})
            """, completed_ayah_ids)
        else:
            cursor.execute("""
                SELECT MIN(number) as ayah_num, MIN(surah_id) as surah_id, MIN(number_in_surah) as ayah_in_surah
                FROM ayahs
            """)
        first_incomplete = cursor.fetchone()

        return {
            "sequential_completion_count": sequential_count,
            "sequential_percentage": round((sequential_count / 6236) * 100, 2),
            "first_incomplete_ayah": first_incomplete["ayah_in_surah"] if first_incomplete else 1,
            "first_incomplete_surah": first_incomplete["surah_id"] if first_incomplete else 1,
            "is_complete": sequential_count == 6236
        }
    finally:
        conn.close()


@app.post("/api/progress/validate-sequential")
async def validate_sequential_progress(current_user: dict = Depends(get_current_user)):
    """
    Recalculate sequential progress flags in Supabase.
    """
    # Get all completed ayahs
    completed = supabase.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
    completed_ayah_ids = [c["ayah_id"] for c in completed.data] if completed.data else []

    # Get all ayahs in order from SQLite
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, surah_id, number_in_surah, number
            FROM ayahs
            ORDER BY surah_id, number_in_surah
        """)
        all_ayahs = cursor.fetchall()

        # Calculate which ayahs are sequential (all previous ones are complete)
        sequential_ids = []
        completed_set = set(completed_ayah_ids)

        for i, ayah in enumerate(all_ayahs):
            if ayah["id"] in completed_set:
                # Check if all previous ayahs are also complete
                all_previous_complete = all(a["id"] in completed_set for a in all_ayahs[:i])
                if all_previous_complete:
                    sequential_ids.append(ayah["id"])

        # Reset all sequential flags and update
        supabase.table("completed_ayahs").update({"is_sequential": False}).eq("user_id", current_user["id"]).execute()

        for ayah_id in sequential_ids:
            supabase.table("completed_ayahs").update({"is_sequential": True}).eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()

        return {"success": True}
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
    response = supabase.table("play_sessions").insert({
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
    session = supabase.table("play_sessions").select("ayah_id").eq("id", data.session_id).eq("user_id", current_user["id"]).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    ayah_id = session.data[0]["ayah_id"]

    # Update play session
    supabase.table("play_sessions").update({
        "completed_at": datetime.now().isoformat(),
        "duration_seconds": data.duration_seconds
    }).eq("id", data.session_id).execute()

    # Update replay stats in Supabase
    existing = supabase.table("replay_stats").select("*").eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()

    if existing.data:
        supabase.table("replay_stats").update({
            "play_count": existing.data[0]["play_count"] + 1,
            "total_duration_seconds": existing.data[0]["total_duration_seconds"] + data.duration_seconds,
            "last_played_at": datetime.now().isoformat()
        }).eq("user_id", current_user["id"]).eq("ayah_id", ayah_id).execute()
    else:
        supabase.table("replay_stats").insert({
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
    response = supabase.table("replay_stats").select("*").eq("user_id", current_user["id"]).order("play_count", desc=True).limit(limit).execute()

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
    completed = supabase.table("completed_ayahs").select("ayah_id").eq("user_id", current_user["id"]).execute()
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
        response = supabase.table("quran_play_sessions").insert({
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
    supabase.table("quran_play_sessions").update({
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
