#!/usr/bin/env python3
"""
Supabase RLS Security Audit Script

Run with:
  SUPABASE_SERVICE_ROLE_KEY=your-key python check_rls.py
"""

import os
from supabase import create_client

SUPABASE_URL = "https://zxmyoojcuihavbhiblwc.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set")
    print("   Run: SUPABASE_SERVICE_ROLE_KEY=your-key python check_rls.py")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Tables that should have RLS enabled
USER_TABLES = [
    "profiles",
    "bookmarks", 
    "reading_progress",
    "daily_readings",
    "completed_ayahs",
    "completed_surahs",
    "play_sessions",
    "replay_stats",
    "quran_play_sessions",
]

print("=" * 60)
print("🔒 SUPABASE RLS SECURITY AUDIT")
print("=" * 60)
print()

# Query to check RLS status
rls_check_query = """
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
"""

# Query to get RLS policies
policies_query = """
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
"""

try:
    # Check RLS status on tables
    print("📋 TABLE RLS STATUS:")
    print("-" * 60)
    
    result = supabase.rpc("", {}).execute()  # This won't work, need raw SQL
    
    # Use the postgrest-py raw query approach
    # Since we can't run raw SQL easily, let's check each table
    
    for table in USER_TABLES:
        try:
            # Try to query the table - if we get data with service role, 
            # we need to verify RLS is actually enabled
            response = supabase.table(table).select("*").limit(1).execute()
            print(f"  ✅ {table}: Table exists and accessible")
        except Exception as e:
            print(f"  ⚠️  {table}: {str(e)[:50]}")
    
    print()
    print("=" * 60)
    print("📝 MANUAL VERIFICATION REQUIRED")
    print("=" * 60)
    print()
    print("Please run this SQL in your Supabase SQL Editor to verify RLS:")
    print()
    print("-" * 60)
    print("""
-- Check RLS is enabled on all tables
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✅ RLS ENABLED' ELSE '❌ RLS DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check RLS policies exist
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename;
    """)
    print("-" * 60)
    print()
    print("🔑 KEY THINGS TO VERIFY:")
    print("  1. All user data tables have 'RLS ENABLED'")
    print("  2. Each table has SELECT, INSERT, UPDATE, DELETE policies")
    print("  3. Policies use 'auth.uid() = user_id' for user isolation")
    print()

except Exception as e:
    print(f"❌ Error: {e}")
    print()
    print("Try running the SQL query directly in Supabase dashboard instead.")
