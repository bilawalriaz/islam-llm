#!/usr/bin/env python3
"""
Migration script to move users and data from SQLite to Supabase

This script:
1. Reads users from SQLite
2. Creates Supabase auth users with temporary passwords
3. Migrates progress tracking data
4. Migrates bookmarks and engagement data

Usage:
    python migrate-to-supabase.py
"""

import os
import sqlite3
import secrets
import hashlib
from datetime import datetime
from typing import Dict, Any

from supabase import create_client, Client

# Configuration
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), 'quran-dump', 'quran.db')
SUPABASE_URL = 'https://zxmyoojcuihavbhiblwc.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    print("You can get this from your Supabase project settings > API > service_role (secret)")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
sqlite_conn.row_factory = sqlite3.Row
cursor = sqlite_conn.cursor()


def migrate_users() -> list[Dict[str, Any]]:
    """Migrate users to Supabase Auth"""
    print("Migrating users...")

    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    temporary_passwords = {}

    for user in users:
        user_dict = dict(user)

        # Generate temporary password (32 hex characters)
        temp_password = secrets.token_hex(16)
        temporary_passwords[user_dict['email']] = temp_password

        # Create user in Supabase Auth
        try:
            response = supabase.auth.admin.create_user({
                'email': user_dict['email'],
                'password': temp_password,
                'email_confirm': True,
                'user_metadata': {
                    'name': user_dict['name']
                }
            })

            if response.user:
                print(f"Created user: {user_dict['email']} (ID: {response.user.id})")
            else:
                print(f"Failed to create user {user_dict['email']}: {response}")
        except Exception as e:
            print(f"Error creating user {user_dict['email']}: {e}")

    print("\n=== TEMPORARY PASSWORDS ===")
    print("Please save these passwords and distribute to users:")
    print("Users will need to change their password on first login.\n")
    for email, password in temporary_passwords.items():
        print(f"{email}: {password}")

    return users


def build_user_map(sqlite_users: list[Dict[str, Any]]) -> Dict[int, str]:
    """Map old SQLite user IDs to new Supabase user IDs"""
    print("\nBuilding user ID mapping...")

    user_map = {}

    for user in sqlite_users:
        user_dict = dict(user)
        old_id = user_dict['id']

        # Get the new Supabase user ID from profiles
        response = supabase.table('profiles').select('id').eq('email', user_dict['email']).execute()

        if response.data:
            user_map[old_id] = response.data[0]['id']
            print(f"Mapped user {old_id} -> {response.data[0]['id']}")

    return user_map


def migrate_reading_progress(user_map: Dict[int, str]):
    """Migrate reading progress records"""
    print("\nMigrating reading progress...")

    cursor.execute("SELECT * FROM reading_progress")
    progress = cursor.fetchall()
    migrated = 0

    for row in progress:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('reading_progress').insert({
                'user_id': new_user_id,
                'surah_id': row_dict['surah_id'],
                'last_read_ayah_id': row_dict['last_read_ayah_id'],
                'last_read_ayah_number': row_dict['last_read_ayah_number'],
                'total_ayahs_read': row_dict['total_ayahs_read'],
                'last_read_date': row_dict['last_read_date'],
                'updated_at': row_dict['updated_at']
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating reading progress: {e}")

    print(f"Migrated {migrated} reading progress records")


def migrate_daily_readings(user_map: Dict[int, str]):
    """Migrate daily reading records"""
    print("Migrating daily readings...")

    cursor.execute("SELECT * FROM daily_readings")
    readings = cursor.fetchall()
    migrated = 0

    for row in readings:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('daily_readings').insert({
                'user_id': new_user_id,
                'read_date': row_dict['read_date'],
                'ayahs_read': row_dict['ayahs_read'],
                'created_at': row_dict['created_at']
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating daily reading: {e}")

    print(f"Migrated {migrated} daily reading records")


def migrate_completed_ayahs(user_map: Dict[int, str]):
    """Migrate completed ayah records"""
    print("Migrating completed ayahs...")

    cursor.execute("SELECT * FROM completed_ayahs")
    ayahs = cursor.fetchall()
    migrated = 0

    for row in ayahs:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('completed_ayahs').insert({
                'user_id': new_user_id,
                'ayah_id': row_dict['ayah_id'],
                'surah_id': row_dict['surah_id'],
                'ayah_number': row_dict['ayah_number'],
                'completed_at': row_dict['completed_at'],
                'is_sequential': bool(row_dict['is_sequential'])
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating completed ayah: {e}")

    print(f"Migrated {migrated} completed ayah records")


def migrate_completed_surahs(user_map: Dict[int, str]):
    """Migrate completed surah records"""
    print("Migrating completed surahs...")

    cursor.execute("SELECT * FROM completed_surahs")
    surahs = cursor.fetchall()
    migrated = 0

    for row in surahs:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('completed_surahs').insert({
                'user_id': new_user_id,
                'surah_id': row_dict['surah_id'],
                'completed_at': row_dict['completed_at']
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating completed surah: {e}")

    print(f"Migrated {migrated} completed surah records")


def migrate_bookmarks(user_map: Dict[int, str]):
    """Migrate bookmark records"""
    print("Migrating bookmarks...")

    cursor.execute("SELECT * FROM bookmarks")
    bookmarks = cursor.fetchall()
    migrated = 0

    for row in bookmarks:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('bookmarks').insert({
                'user_id': new_user_id,
                'ayah_id': row_dict['ayah_id'],
                'surah_id': row_dict['surah_id'],
                'ayah_number_in_surah': row_dict['ayah_number_in_surah'],
                'created_at': row_dict['created_at']
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating bookmark: {e}")

    print(f"Migrated {migrated} bookmark records")


def migrate_play_sessions(user_map: Dict[int, str]):
    """Migrate play session records"""
    print("Migrating play sessions...")

    cursor.execute("SELECT * FROM play_sessions")
    sessions = cursor.fetchall()
    migrated = 0

    for row in sessions:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('play_sessions').insert({
                'user_id': new_user_id,
                'ayah_id': row_dict['ayah_id'],
                'surah_id': row_dict['surah_id'],
                'ayah_number': row_dict['ayah_number'],
                'audio_edition': row_dict.get('audio_edition') or 'ar.alafasy',
                'started_at': row_dict['started_at'],
                'completed_at': row_dict.get('completed_at'),
                'duration_seconds': row_dict.get('duration_seconds')
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating play session: {e}")

    print(f"Migrated {migrated} play session records")


def migrate_replay_stats(user_map: Dict[int, str]):
    """Migrate replay stats records"""
    print("Migrating replay stats...")

    cursor.execute("SELECT * FROM replay_stats")
    stats = cursor.fetchall()
    migrated = 0

    for row in stats:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('replay_stats').insert({
                'user_id': new_user_id,
                'ayah_id': row_dict['ayah_id'],
                'play_count': row_dict['play_count'],
                'total_duration_seconds': row_dict['total_duration_seconds'],
                'last_played_at': row_dict['last_played_at']
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating replay stats: {e}")

    print(f"Migrated {migrated} replay stats records")


def migrate_quran_play_sessions(user_map: Dict[int, str]):
    """Migrate Quran play session records"""
    print("Migrating Quran play sessions...")

    cursor.execute("SELECT * FROM quran_play_sessions")
    sessions = cursor.fetchall()
    migrated = 0

    for row in sessions:
        row_dict = dict(row)
        new_user_id = user_map.get(row_dict['user_id'])

        if not new_user_id:
            continue

        try:
            supabase.table('quran_play_sessions').insert({
                'user_id': new_user_id,
                'start_surah_id': row_dict['start_surah_id'],
                'start_ayah_number': row_dict['start_ayah_number'],
                'end_surah_id': row_dict.get('end_surah_id'),
                'end_ayah_number': row_dict.get('end_ayah_number'),
                'audio_edition': row_dict.get('audio_edition') or 'ar.alafasy',
                'started_at': row_dict['started_at'],
                'ended_at': row_dict.get('ended_at'),
                'ayahs_played': row_dict['ayahs_played']
            }).execute()
            migrated += 1
        except Exception as e:
            print(f"Error migrating Quran play session: {e}")

    print(f"Migrated {migrated} Quran play session records")


def main():
    """Main migration function"""
    try:
        print("Starting migration to Supabase...\n")

        # Migrate users first
        users = [dict(u) for u in migrate_users()]

        # Wait a bit for profiles to be created via trigger
        import time
        time.sleep(3)

        # Build user ID mapping
        user_map = build_user_map(users)

        # Migrate all data
        migrate_reading_progress(user_map)
        migrate_daily_readings(user_map)
        migrate_completed_ayahs(user_map)
        migrate_completed_surahs(user_map)
        migrate_bookmarks(user_map)
        migrate_play_sessions(user_map)
        migrate_replay_stats(user_map)
        migrate_quran_play_sessions(user_map)

        print("\n=== Migration complete! ===")
    except Exception as error:
        print(f"Migration failed: {error}")
        import traceback
        traceback.print_exc()
        exit(1)
    finally:
        sqlite_conn.close()


if __name__ == "__main__":
    main()